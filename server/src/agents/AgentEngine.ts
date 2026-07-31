import type Anthropic from '@anthropic-ai/sdk';
import type { Agent, AgentMemoryType, MeetingMessage, Meeting } from '@evoluze/shared';
import { complete } from '../services/anthropic.js';
import { getAgent, topMemories, addMemory } from '../db/repo.js';

/**
 * Motor de um agente individual.
 * REGRA DE OURO: nenhuma chamada à API acontece com agente parado. Só há
 * chamada em (a) chat 1:1 iniciado pelo usuário e (b) reunião ativa.
 */

export interface MeetingContextInput {
  meeting: Meeting;
  transcript: MeetingMessage[];
  /** resumo progressivo do histórico antigo (após round 6) */
  runningSummary?: string;
  /** instrução extra do orquestrador para o round atual (ex: convergência) */
  turnDirective?: string;
}

const MODE_GUIDANCE: Record<Meeting['mode'], string> = {
  debate:
    'MODO DEBATE: discorde abertamente quando fizer sentido, aponte furos, defenda sua posição com evidência. Confronto saudável é bem-vindo.',
  brainstorm:
    'MODO BRAINSTORM: divirja, gere ideias, construa sobre a fala dos outros. NÃO critique nem filtre agora — quantidade e variedade importam.',
  decisao:
    'MODO DECISÃO: convirja rápido. Seja objetivo, tome posição, proponha o próximo passo concreto. Evite reabrir o que já foi discutido.',
};

export class AgentEngine {
  /**
   * Monta o system prompt do agente para uma reunião:
   * persona + knowledge_scope + memórias relevantes + contexto da empresa
   * (já embutido no persona_system_prompt do seed) + pauta + modo.
   */
  buildContext(agent: Agent, input: MeetingContextInput): { system: string; messages: Anthropic.MessageParam[] } {
    const memories = topMemories(agent.id, 6);
    const memoryBlock = memories.length
      ? memories.map((m) => `- (${m.type}, imp ${m.importance}) ${m.content}`).join('\n')
      : '— (sem memórias prévias)';

    const traits = Object.entries(agent.personalityTraits)
      .map(([k, v]) => `${k}=${v}`)
      .join(', ');

    const system = [
      agent.personaSystemPrompt,
      '',
      `=== SEU ESCOPO DE CONHECIMENTO ===\n${agent.knowledgeScope}`,
      `=== SEUS TRAÇOS (0..10) ===\n${traits}`,
      `=== SUA MEMÓRIA DE REUNIÕES ANTERIORES ===\n${memoryBlock}`,
      '',
      `=== REUNIÃO ATUAL ===\nTítulo: ${input.meeting.title}\nPauta: ${input.meeting.agenda}`,
      MODE_GUIDANCE[input.meeting.mode],
      '',
      'REGRAS DE FALA:',
      '- Máximo 6 linhas. Fala de reunião é curta, não é ensaio.',
      '- Fale em primeira pessoa, como você mesmo. NÃO narre ("o Ricardo diz...").',
      '- Cite colegas pelo primeiro nome quando responder ou discordar deles.',
      '- Não repita o que já foi dito; avance a discussão.',
      '- Você NÃO decide nada; você recomenda. Quem decide é o Gustavo (CEO).',
      input.runningSummary
        ? `\n=== RESUMO DO QUE JÁ FOI DISCUTIDO ===\n${input.runningSummary}`
        : '',
    ]
      .filter(Boolean)
      .join('\n');

    // Histórico como uma única mensagem de usuário (o "chão" da conversa),
    // pois todos os agentes compartilham o mesmo transcript.
    const transcriptText = input.transcript.length
      ? input.transcript
          .map((m) => `[Round ${m.roundNumber}] ${m.speakerName}: ${m.content}`)
          .join('\n')
      : '(A reunião está começando. Ninguém falou ainda.)';

    const directive = input.turnDirective
      ? `\n\nINSTRUÇÃO PARA SUA FALA AGORA: ${input.turnDirective}`
      : '\n\nDê sua contribuição para a reunião agora.';

    const messages: Anthropic.MessageParam[] = [
      {
        role: 'user',
        content: `TRANSCRIÇÃO ATÉ AGORA:\n${transcriptText}${directive}`,
      },
    ];

    return { system, messages };
  }

  /** Uma única chamada à Anthropic. Retorna a fala do agente. */
  async speak(agent: Agent, input: MeetingContextInput, maxTokens = 350) {
    const { system, messages } = this.buildContext(agent, input);
    const res = await complete({
      model: agent.model,
      system,
      messages,
      maxTokens,
      temperature: input.meeting.mode === 'brainstorm' ? 0.95 : 0.8,
    });
    return res;
  }

  /**
   * Ao fim da reunião, extrai decisões/compromissos/insights da participação do
   * agente e grava em agent_memory. Uma única chamada por agente.
   */
  async extractMemory(agentId: string, meeting: Meeting, transcript: MeetingMessage[]) {
    const agent = getAgent(meeting.orgId, agentId);
    if (!agent) return;
    const myLines = transcript
      .filter((m) => m.speakerId === agentId)
      .map((m) => m.content)
      .join('\n');
    if (!myLines.trim()) return;

    const system = `Você extrai memória estruturada da participação de ${agent.name} (${agent.jobTitle}) numa reunião.
Retorne SOMENTE JSON no formato:
{"memories":[{"type":"decision|insight|commitment|context","content":"...","importance":1-5}]}
Máximo 4 itens. content curto (1 frase). Foque no que ${agent.name} vai querer lembrar em reuniões futuras.`;

    const res = await complete({
      model: 'claude-haiku-4-5',
      system,
      messages: [
        {
          role: 'user',
          content: `Pauta: ${meeting.title} — ${meeting.agenda}\n\nMinhas falas na reunião:\n${myLines}`,
        },
      ],
      maxTokens: 400,
      temperature: 0.3,
    });

    try {
      const parsed = JSON.parse(stripFences(res.text)) as {
        memories: Array<{ type: AgentMemoryType; content: string; importance: number }>;
      };
      for (const m of parsed.memories ?? []) {
        addMemory(agentId, meeting.id, m.type, m.content, clamp(m.importance, 1, 5));
      }
    } catch {
      // Se o modelo não retornar JSON válido, guarda um resumo bruto de baixa importância.
      addMemory(agentId, meeting.id, 'context', res.text.slice(0, 240), 2);
    }
    return res;
  }
}

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, Math.round(n || lo)));
}

export function stripFences(s: string): string {
  return s
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```\s*$/i, '')
    .trim();
}

export const agentEngine = new AgentEngine();
