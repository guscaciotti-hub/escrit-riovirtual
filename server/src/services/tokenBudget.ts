import { MODEL_PRICING, type AgentModel, type TokenEstimate } from '@evoluze/shared';

/**
 * Controle de custo de reunião (implementado de verdade — não é opcional).
 * - Estimativa antes de confirmar.
 * - Acompanhamento acumulado em tempo real.
 * - Limite de tokens que força round final de convergência.
 */

/** Média empírica de tokens (in+out) por turno de fala em reunião. */
const AVG_TOKENS_PER_TURN = 900;

/**
 * Estima turnos e tokens de uma reunião.
 * Turnos ≈ abertura (1/agente) + debate (~1.5 falas/agente por round) + convergência (1/agente).
 */
export function estimateMeeting(rounds: number, participants: number): TokenEstimate {
  const opening = participants;
  const debate = Math.max(0, rounds - 2) * Math.ceil(participants * 1.2);
  const closing = participants;
  const estimatedTurns = opening + debate + closing;
  const estimatedTokens = estimatedTurns * AVG_TOKENS_PER_TURN;
  // custo aproximado usando blend haiku(debate)/sonnet(abertura+ata)
  const blendedInput = 1.4; // USD/MTok aproximado ponderado
  const blendedOutput = 7; // USD/MTok aproximado ponderado
  const inTok = estimatedTokens * 0.6;
  const outTok = estimatedTokens * 0.4;
  const estimatedCostUsd = (inTok / 1_000_000) * blendedInput + (outTok / 1_000_000) * blendedOutput;
  return {
    rounds,
    participants,
    avgTokensPerTurn: AVG_TOKENS_PER_TURN,
    estimatedTurns,
    estimatedTokens,
    estimatedCostUsd: Number(estimatedCostUsd.toFixed(4)),
  };
}

export function costOfUsage(model: AgentModel, tokensIn: number, tokensOut: number): number {
  const p = MODEL_PRICING[model];
  return (tokensIn / 1_000_000) * p.inputPerMTok + (tokensOut / 1_000_000) * p.outputPerMTok;
}

/** Acumulador de custo em tempo real durante a reunião. */
export class MeetingBudget {
  tokensIn = 0;
  tokensOut = 0;
  costUsd = 0;
  constructor(public readonly maxTokens: number) {}

  add(model: AgentModel, tokensIn: number, tokensOut: number) {
    this.tokensIn += tokensIn;
    this.tokensOut += tokensOut;
    this.costUsd += costOfUsage(model, tokensIn, tokensOut);
  }

  get totalTokens(): number {
    return this.tokensIn + this.tokensOut;
  }

  /** true quando o orçamento estourou → orquestrador força convergência. */
  get exceeded(): boolean {
    return this.totalTokens >= this.maxTokens;
  }
}
