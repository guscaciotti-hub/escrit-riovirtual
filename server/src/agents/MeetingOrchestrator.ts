import type {
  Agent,
  Meeting,
  MeetingMessage,
  MeetingMinutes,
  User,
} from '@evoluze/shared';
import { complete } from '../services/anthropic.js';
import { MeetingBudget } from '../services/tokenBudget.js';
import { agentEngine, stripFences } from './AgentEngine.js';
import {
  addMeetingMessage,
  bumpMeetingCost,
  listMeetingMessages,
  saveMinutes,
  setMeetingStatus,
} from '../db/repo.js';

/**
 * Orquestrador de reunião — o coração do produto.
 * Roda o loop de rounds, escolhe quem fala dinamicamente, aceita intervenção
 * do CEO (peso máximo), resume o histórico progressivamente, respeita o
 * orçamento de tokens e gera a ata ao fim.
 */

export interface MeetingEmitter {
  message(msg: MeetingMessage): void;
  thinking(agentId: string, agentName: string): void;
  round(round: number, totalRounds: number): void;
  usage(tokensIn: number, tokensOut: number, cumulativeTokens: number, cumulativeCostUsd: number): void;
  minutes(m: MeetingMinutes): void;
  finished(): void;
  error(message: string): void;
}

const nowIso = () => new Date().toISOString();

export class MeetingOrchestrator {
  private budget: MeetingBudget;
  private pendingInterventions: string[] = [];
  private runningSummary = '';
  private stopped = false;

  constructor(
    private meeting: Meeting,
    private agents: Agent[], // ordenados por senioridade (ordem de abertura)
    private user: User,
    private emit: MeetingEmitter,
  ) {
    this.budget = new MeetingBudget(meeting.maxTokens);
  }

  /** CEO digita durante a reunião — peso máximo, redireciona o round seguinte. */
  intervene(content: string) {
    const msg = addMeetingMessage(
      this.meeting.id,
      'user',
      this.user.id,
      `${this.user.name} (CEO)`,
      this.currentRound,
      content,
    );
    this.emit.message(msg);
    this.pendingInterventions.push(content);
  }

  stop() {
    this.stopped = true;
  }

  private currentRound = 0;

  private transcript(): MeetingMessage[] {
    return listMeetingMessages(this.meeting.id);
  }

  private post(agent: Agent, round: number, content: string, tin: number, tout: number): MeetingMessage {
    const msg = addMeetingMessage(this.meeting.id, 'agent', agent.id, agent.name, round, content, tin, tout);
    this.budget.add(agent.model, tin, tout);
    bumpMeetingCost(this.meeting.id, this.budget.totalTokens);
    this.emit.message(msg);
    this.emit.usage(tin, tout, this.budget.totalTokens, Number(this.budget.costUsd.toFixed(4)));
    return msg;
  }

  private postSystem(content: string, round: number) {
    const msg = addMeetingMessage(this.meeting.id, 'system', null, 'Sistema', round, content);
    this.emit.message(msg);
  }

  /** Consome intervenções pendentes e devolve uma diretiva obrigatória. */
  private drainInterventionDirective(): string | undefined {
    if (this.pendingInterventions.length === 0) return undefined;
    const items = this.pendingInterventions.splice(0);
    return `O CEO Gustavo interveio e sua fala tem peso máximo. Você DEVE endereçar diretamente: "${items.join(' | ')}". Ajuste sua posição a isso.`;
  }

  async run() {
    try {
      setMeetingStatus(this.meeting.id, 'running', { startedAt: nowIso() });
      this.postSystem(
        `Reunião iniciada: "${this.meeting.title}". Pauta: ${this.meeting.agenda}. Modo: ${this.meeting.mode}. Participantes: ${this.agents.map((a) => a.name).join(', ')}.`,
        0,
      );

      // ---- Round 0: Abertura (leitura inicial, ordem por senioridade) ----
      this.currentRound = 0;
      this.emit.round(0, this.meeting.maxRounds);
      for (const agent of this.agents) {
        if (this.stopped) return this.finish();
        await this.turn(agent, 0, 'Faça sua LEITURA INICIAL da pauta em até 4 linhas: o que mais importa aqui do seu ponto de vista.', true);
      }

      // ---- Rounds 1..N-1: Debate dinâmico ----
      const debateRounds = Math.max(1, this.meeting.maxRounds - 1);
      for (let round = 1; round < debateRounds; round++) {
        if (this.stopped || this.budget.exceeded) break;
        this.currentRound = round;
        this.emit.round(round, this.meeting.maxRounds);
        await this.maybeSummarize(round);

        // ~1 fala por participante por round, com seleção dinâmica de quem fala.
        const turnsThisRound = this.agents.length;
        for (let t = 0; t < turnsThisRound; t++) {
          if (this.stopped || this.budget.exceeded) break;
          const directive = this.drainInterventionDirective();
          const speaker = this.pickSpeaker();
          await this.turn(speaker, round, directive, false);
        }
      }

      // ---- Round final: Convergência ----
      if (!this.stopped) {
        this.currentRound = this.meeting.maxRounds;
        this.emit.round(this.meeting.maxRounds, this.meeting.maxRounds);
        this.postSystem(
          this.budget.exceeded
            ? 'Orçamento de tokens atingido — indo direto para a convergência.'
            : 'Round final: cada um declara sua posição final e propõe ações concretas.',
          this.currentRound,
        );
        for (const agent of this.agents) {
          if (this.stopped) break;
          await this.turn(
            agent,
            this.currentRound,
            'CONVERGÊNCIA: declare sua posição FINAL e proponha 1-2 AÇÕES CONCRETAS do seu escopo, com prazo sugerido. Máximo 4 linhas.',
            true,
          );
        }
      }

      await this.generateMinutes();
      await this.finish();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.emit.error(message);
      setMeetingStatus(this.meeting.id, 'finished', { finishedAt: nowIso() });
    }
  }

  private lastSpeakerId: string | null = null;
  private speakCount = new Map<string, number>();

  private async turn(agent: Agent, round: number, directive: string | undefined, reasoning: boolean) {
    this.emit.thinking(agent.id, agent.name);
    // Abertura/convergência usam o modelo do agente (sonnet por padrão);
    // falas de debate podem usar haiku para reduzir custo.
    const debateAgent: Agent = reasoning ? agent : { ...agent, model: 'claude-haiku-4-5' };
    const res = await agentEngine.speak(
      debateAgent,
      {
        meeting: this.meeting,
        transcript: this.recentTranscript(),
        runningSummary: this.runningSummary || undefined,
        turnDirective: directive,
      },
      round === 0 || reasoning ? 350 : 300,
    );
    this.post(agent, round, res.text, res.tokensIn, res.tokensOut);
    this.lastSpeakerId = agent.id;
    this.speakCount.set(agent.id, (this.speakCount.get(agent.id) ?? 0) + 1);
  }

  /** Mantém apenas as últimas ~10 falas no contexto (o resto vira runningSummary). */
  private recentTranscript(): MeetingMessage[] {
    const all = this.transcript();
    return all.slice(-10);
  }

  /** Após o round 6, resume as falas antigas progressivamente. */
  private async maybeSummarize(round: number) {
    if (round < 6) return;
    const all = this.transcript();
    if (all.length <= 12) return;
    const older = all.slice(0, all.length - 10);
    const text = older.map((m) => `${m.speakerName}: ${m.content}`).join('\n');
    try {
      const res = await complete({
        model: 'claude-haiku-4-5',
        system:
          'Resuma a discussão de reunião abaixo em até 6 bullets objetivos, preservando decisões, discordâncias e números citados. Português.',
        messages: [{ role: 'user', content: text }],
        maxTokens: 300,
        temperature: 0.3,
      });
      this.runningSummary = res.text;
      this.budget.add('claude-haiku-4-5', res.tokensIn, res.tokensOut);
    } catch {
      /* resumo é best-effort */
    }
  }

  /**
   * Seleção dinâmica de quem fala: relevância ao knowledge_scope, se foi citado
   * na última fala, trait de assertividade, e penalidade por falar seguido.
   */
  private pickSpeaker(): Agent {
    const transcript = this.transcript();
    const last = transcript[transcript.length - 1];
    const lastText = (last?.content ?? '').toLowerCase();
    const topicText = `${this.meeting.agenda} ${lastText}`.toLowerCase();

    let best: Agent = this.agents[0];
    let bestScore = -Infinity;
    for (const agent of this.agents) {
      let score = 0;
      // relevância: overlap de palavras do escopo com o tema/última fala
      score += keywordOverlap(agent.knowledgeScope, topicText) * 3;
      // citado pelo nome na última fala
      const firstName = agent.name.split(' ')[0].toLowerCase();
      if (lastText.includes(firstName)) score += 6;
      // assertividade
      score += (agent.personalityTraits['assertividade'] ?? 5) * 0.4;
      // penalidade por ter acabado de falar
      if (agent.id === this.lastSpeakerId) score -= 8;
      // leve penalidade por ter falado muito (equilíbrio de turnos)
      score -= (this.speakCount.get(agent.id) ?? 0) * 0.6;
      // desempate estável
      score += agent.id.length * 1e-6;
      if (score > bestScore) {
        bestScore = score;
        best = agent;
      }
    }
    return best;
  }

  /** Ata automática — uma única chamada (modelo de raciocínio). */
  private async generateMinutes() {
    const transcript = this.transcript();
    const convo = transcript
      .filter((m) => m.speakerType !== 'system')
      .map((m) => `${m.speakerName}: ${m.content}`)
      .join('\n');

    const system = `Você é o secretário executivo da reunião da Evoluze. Gere a ATA em JSON.
Formato EXATO:
{
  "summary": "resumo executivo em no máximo 5 linhas",
  "decisions": [{"decision":"...","rationale":"..."}],
  "actionItems": [{"task":"...","owner":"nome do agente","dueSuggestion":"ex: 2 semanas"}],
  "openQuestions": ["pergunta que precisa de decisão do Gustavo"]
}
Responsáveis (owner) devem ser um dos participantes: ${this.agents.map((a) => a.name).join(', ')}.
Só JSON, sem texto fora do JSON.`;

    let minutesData: Omit<MeetingMinutes, 'id' | 'meetingId' | 'createdAt'> = {
      summary: '',
      decisions: [],
      actionItems: [],
      openQuestions: [],
    };

    try {
      const res = await complete({
        model: 'claude-sonnet-4-6',
        system,
        messages: [
          { role: 'user', content: `Pauta: ${this.meeting.title}\n${this.meeting.agenda}\n\nTranscrição:\n${convo}` },
        ],
        maxTokens: 1200,
        temperature: 0.4,
      });
      this.budget.add('claude-sonnet-4-6', res.tokensIn, res.tokensOut);
      bumpMeetingCost(this.meeting.id, this.budget.totalTokens);
      const parsed = JSON.parse(stripFences(res.text));
      minutesData = {
        summary: parsed.summary ?? '',
        decisions: Array.isArray(parsed.decisions) ? parsed.decisions : [],
        actionItems: (Array.isArray(parsed.actionItems) ? parsed.actionItems : []).map((a: any) => ({
          task: a.task ?? '',
          owner: a.owner ?? '',
          ownerAgentId: this.agents.find((ag) => ag.name === a.owner)?.id ?? null,
          dueSuggestion: a.dueSuggestion ?? '',
        })),
        openQuestions: Array.isArray(parsed.openQuestions) ? parsed.openQuestions : [],
      };
    } catch (err) {
      minutesData.summary = `Não foi possível gerar a ata estruturada automaticamente (${
        err instanceof Error ? err.message : 'erro'
      }). Consulte a transcrição.`;
    }

    const saved = saveMinutes(this.meeting.id, minutesData);
    this.emit.minutes(saved);

    // Extração de memória por agente (best-effort, em paralelo).
    await Promise.allSettled(
      this.agents.map((a) => agentEngine.extractMemory(a.id, this.meeting, transcript)),
    );
  }

  private async finish() {
    setMeetingStatus(this.meeting.id, 'finished', {
      finishedAt: nowIso(),
      tokenCostActual: this.budget.totalTokens,
    });
    this.emit.finished();
  }
}

/** Fração de palavras significativas do escopo presentes no texto do tema. */
function keywordOverlap(scope: string, topic: string): number {
  const words = scope
    .toLowerCase()
    .replace(/[.,;:()]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 4);
  if (words.length === 0) return 0;
  let hits = 0;
  for (const w of new Set(words)) {
    if (topic.includes(w)) hits++;
  }
  return hits / Math.sqrt(words.length);
}
