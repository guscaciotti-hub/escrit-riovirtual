import { Router } from 'express';
import { z } from 'zod';
import type Anthropic from '@anthropic-ai/sdk';
import { getCurrentOrg, getCurrentUser } from '../middleware/auth.js';
import { getAgent, topMemories } from '../db/repo.js';
import { complete, hasApiKey } from '../services/anthropic.js';
import { costOfUsage } from '../services/tokenBudget.js';

export const chatRouter = Router();

const chatSchema = z.object({
  message: z.string().min(1),
  history: z
    .array(z.object({ role: z.enum(['user', 'assistant']), content: z.string() }))
    .max(20)
    .optional(),
});

/**
 * Chat 1:1 por proximidade — a ÚNICA interação que gasta token fora de reunião.
 * Uma chamada por mensagem. O client mostra o contador de tokens.
 */
chatRouter.post('/:agentId', async (req, res) => {
  const org = getCurrentOrg(req);
  const user = getCurrentUser(req);
  const agent = getAgent(org.id, req.params.agentId);
  if (!agent) return res.status(404).json({ error: 'Agente não encontrado' });
  if (!hasApiKey()) {
    return res.status(503).json({ error: 'ANTHROPIC_API_KEY não configurada no servidor.' });
  }
  const parsed = chatSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const memories = topMemories(agent.id, 5);
  const memoryBlock = memories.length
    ? memories.map((m) => `- (${m.type}) ${m.content}`).join('\n')
    : '— (sem memórias)';

  const system = [
    agent.personaSystemPrompt,
    `\n=== SEU ESCOPO ===\n${agent.knowledgeScope}`,
    `\n=== SUA MEMÓRIA ===\n${memoryBlock}`,
    `\nVocê está numa conversa 1:1 informal com ${user.name} (CEO) na mesa do escritório.`,
    'Responda curto e direto (máx 6 linhas), em primeira pessoa, português brasileiro.',
  ].join('\n');

  const messages: Anthropic.MessageParam[] = [
    ...(parsed.data.history ?? []).map((h) => ({ role: h.role, content: h.content })),
    { role: 'user' as const, content: parsed.data.message },
  ];

  try {
    const result = await complete({ model: agent.model, system, messages, maxTokens: 400, temperature: 0.7 });
    res.json({
      reply: result.text,
      tokensIn: result.tokensIn,
      tokensOut: result.tokensOut,
      costUsd: Number(costOfUsage(agent.model, result.tokensIn, result.tokensOut).toFixed(5)),
    });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Erro na chamada ao modelo' });
  }
});
