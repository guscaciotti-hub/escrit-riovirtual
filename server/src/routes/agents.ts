import { Router } from 'express';
import { z } from 'zod';
import { getCurrentOrg } from '../middleware/auth.js';
import { createAgent, deleteAgent, getAgent, listAgents, updateAgent } from '../db/repo.js';

export const agentsRouter = Router();

const avatarSchema = z.object({ sprite: z.string(), tint: z.string().optional() }).partial({ sprite: true });

const createSchema = z.object({
  name: z.string().min(1),
  jobTitle: z.string().min(1),
  department: z.string().min(1),
  avatarConfig: avatarSchema.optional(),
  spawnX: z.number(),
  spawnY: z.number(),
  deskId: z.string().nullable().optional(),
  personaSystemPrompt: z.string().min(1),
  personalityTraits: z.record(z.number()).optional(),
  knowledgeScope: z.string().min(1),
  model: z.enum(['claude-sonnet-4-6', 'claude-haiku-4-5']).optional(),
});

const updateSchema = createSchema.partial().extend({ isActive: z.boolean().optional() });

agentsRouter.get('/', (req, res) => {
  const org = getCurrentOrg(req);
  res.json(listAgents(org.id));
});

agentsRouter.get('/:id', (req, res) => {
  const org = getCurrentOrg(req);
  const agent = getAgent(org.id, req.params.id);
  if (!agent) return res.status(404).json({ error: 'Agente não encontrado' });
  res.json(agent);
});

agentsRouter.post('/', (req, res) => {
  const org = getCurrentOrg(req);
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const agent = createAgent(org.id, {
    ...parsed.data,
    avatarConfig: parsed.data.avatarConfig as { sprite: string; tint?: string } | undefined,
  });
  res.status(201).json(agent);
});

agentsRouter.patch('/:id', (req, res) => {
  const org = getCurrentOrg(req);
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const agent = updateAgent(org.id, req.params.id, parsed.data as any);
  if (!agent) return res.status(404).json({ error: 'Agente não encontrado' });
  res.json(agent);
});

agentsRouter.delete('/:id', (req, res) => {
  const org = getCurrentOrg(req);
  const ok = deleteAgent(org.id, req.params.id);
  if (!ok) return res.status(404).json({ error: 'Agente não encontrado' });
  res.status(204).end();
});
