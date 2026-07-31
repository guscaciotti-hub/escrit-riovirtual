import { Router } from 'express';
import { z } from 'zod';
import { minutesToMarkdown } from '@evoluze/shared';
import { getCurrentOrg } from '../middleware/auth.js';
import { getMeeting, getMinutes, listMeetingMessages, listMeetings } from '../db/repo.js';
import { estimateMeeting } from '../services/tokenBudget.js';

export const meetingsRouter = Router();

const estimateSchema = z.object({
  rounds: z.number().int().min(1).max(30),
  participants: z.number().int().min(1).max(12),
});

/** Estimativa de tokens/custo ANTES de confirmar a reunião. */
meetingsRouter.post('/estimate', (req, res) => {
  const parsed = estimateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  res.json(estimateMeeting(parsed.data.rounds, parsed.data.participants));
});

meetingsRouter.get('/', (req, res) => {
  const org = getCurrentOrg(req);
  res.json(listMeetings(org.id));
});

meetingsRouter.get('/:id', (req, res) => {
  const org = getCurrentOrg(req);
  const meeting = getMeeting(org.id, req.params.id);
  if (!meeting) return res.status(404).json({ error: 'Reunião não encontrada' });
  res.json({
    meeting,
    messages: listMeetingMessages(meeting.id),
    minutes: getMinutes(meeting.id),
  });
});

/** Export da ata em Markdown. */
meetingsRouter.get('/:id/export.md', (req, res) => {
  const org = getCurrentOrg(req);
  const meeting = getMeeting(org.id, req.params.id);
  if (!meeting) return res.status(404).json({ error: 'Reunião não encontrada' });
  const minutes = getMinutes(meeting.id);
  if (!minutes) return res.status(404).json({ error: 'Ata ainda não gerada' });
  const md = minutesToMarkdown(meeting, minutes);
  res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="ata-${meeting.id}.md"`);
  res.send(md);
});
