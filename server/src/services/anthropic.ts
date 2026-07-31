import Anthropic from '@anthropic-ai/sdk';
import type { AgentModel } from '@evoluze/shared';

/**
 * Wrapper fino sobre o SDK da Anthropic.
 * A chave vem de ANTHROPIC_API_KEY (.env). Sem chave, o cliente lança erro
 * amigável só quando alguém tenta chamar — o mapa/movimentação não dependem disso.
 */

let client: Anthropic | null = null;

export function hasApiKey(): boolean {
  return !!process.env.ANTHROPIC_API_KEY;
}

function getClient(): Anthropic {
  if (!hasApiKey()) {
    throw new Error(
      'ANTHROPIC_API_KEY não configurada. Adicione a chave no .env para usar chat 1:1 e reuniões.',
    );
  }
  if (!client) client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return client;
}

export interface CompletionResult {
  text: string;
  tokensIn: number;
  tokensOut: number;
}

export interface CompletionParams {
  model: AgentModel;
  system: string;
  messages: Anthropic.MessageParam[];
  maxTokens?: number;
  temperature?: number;
}

/** Uma única chamada à Anthropic. Retorna texto + contagem de tokens. */
export async function complete(params: CompletionParams): Promise<CompletionResult> {
  const anthropic = getClient();
  const res = await anthropic.messages.create({
    model: params.model,
    system: params.system,
    messages: params.messages,
    max_tokens: params.maxTokens ?? 350,
    temperature: params.temperature ?? 0.8,
  });
  const text = res.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('\n')
    .trim();
  return {
    text,
    tokensIn: res.usage.input_tokens,
    tokensOut: res.usage.output_tokens,
  };
}
