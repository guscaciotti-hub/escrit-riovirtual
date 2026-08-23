import type { Server, Socket } from 'socket.io';
import {
  MEETING_ROOM_ID,
  MEETING_SEATS,
  type ClientToServerEvents,
  type CreateMeetingInput,
  type EntityState,
  type SeatAssignment,
  type ServerToClientEvents,
} from '@evoluze/shared';
import { resolveDefaultAuth } from '../middleware/auth.js';
import { createMeeting, getAgent, getMeeting } from '../db/repo.js';
import { estimateMeeting } from '../services/tokenBudget.js';
import { hasApiKey } from '../services/anthropic.js';
import { MeetingOrchestrator } from '../agents/MeetingOrchestrator.js';
import * as activity from '../services/activity.js';

type IO = Server<ClientToServerEvents, ServerToClientEvents>;
type IOSocket = Socket<ClientToServerEvents, ServerToClientEvents>;

/** Presença em memória por org (pronto para multiplayer: rooms por org_id). */
const presenceByOrg = new Map<string, Map<string, EntityState>>();
/** Orquestradores ativos por meetingId. */
const activeMeetings = new Map<string, MeetingOrchestrator>();

function orgRoom(orgId: string) {
  return `org:${orgId}`;
}

export function registerSockets(io: IO) {
  io.on('connection', (socket: IOSocket) => {
    const auth = resolveDefaultAuth();
    if (!auth) {
      socket.disconnect();
      return;
    }
    const { org, user } = auth;
    socket.join(orgRoom(org.id));
    if (!presenceByOrg.has(org.id)) presenceByOrg.set(org.id, new Map());
    const presence = presenceByOrg.get(org.id)!;

    // ---- Presença ----
    socket.on('presence:join', () => {
      const entity: EntityState = {
        id: user.id,
        kind: 'user',
        name: user.name,
        x: 0,
        y: 0,
        facing: 'down',
        moving: false,
      };
      presence.set(socket.id, entity);
      // Rastreio de atividade só começa se houver consentimento vigente.
      activity.startSession(org.id, user.id, 'office');
      socket.emit('presence:sync', Array.from(presence.values()));
      socket.to(orgRoom(org.id)).emit('presence:update', entity);
    });

    socket.on('presence:move', (payload) => {
      const entity = presence.get(socket.id);
      if (!entity) return;
      entity.x = payload.x;
      entity.y = payload.y;
      entity.facing = payload.facing;
      entity.moving = payload.moving;
      activity.trackPosition(org.id, user.id, payload.x, payload.y);
      socket.to(orgRoom(org.id)).emit('presence:update', entity);
    });

    // ---- Reunião: convocação ----
    socket.on('meeting:convene', async (input: CreateMeetingInput, ack) => {
      try {
        if (!input.title?.trim() || !input.agenda?.trim()) {
          return ack({ error: 'Título e pauta são obrigatórios.' });
        }
        if (!input.agentIds?.length) {
          return ack({ error: 'Selecione ao menos um agente.' });
        }
        if (!hasApiKey()) {
          return ack({ error: 'ANTHROPIC_API_KEY não configurada no servidor. Reunião gasta tokens.' });
        }
        // valida agentes pertencem à org
        for (const id of input.agentIds) {
          if (!getAgent(org.id, id)) return ack({ error: `Agente ${id} inválido.` });
        }
        const est = estimateMeeting(input.maxRounds, input.agentIds.length);
        const meeting = createMeeting(org.id, input, input.roomId ?? MEETING_ROOM_ID, est.estimatedTokens);

        // Atribui assentos (na ordem dos agentes selecionados).
        const seats: SeatAssignment[] = input.agentIds.map((agentId, i) => ({
          agentId,
          x: MEETING_SEATS[i % MEETING_SEATS.length].x,
          y: MEETING_SEATS[i % MEETING_SEATS.length].y,
        }));

        io.to(orgRoom(org.id)).emit('meeting:convened', { meeting, seats });
        ack({ meetingId: meeting.id });
      } catch (err) {
        ack({ error: err instanceof Error ? err.message : 'Erro ao convocar reunião' });
      }
    });

    // ---- Reunião: todos sentados + CEO na sala → inicia orquestrador ----
    socket.on('meeting:ready', async ({ meetingId }) => {
      if (activeMeetings.has(meetingId)) return; // já rodando (idempotente)
      const meeting = getMeeting(org.id, meetingId);
      if (!meeting || meeting.status !== 'scheduled') return;

      const agentIds = (
        await import('../db/repo.js')
      ).meetingParticipantAgentIds(meetingId);
      const agents = agentIds
        .map((id) => getAgent(org.id, id))
        .filter((a): a is NonNullable<typeof a> => !!a)
        // ordem de abertura: por senioridade aproximada (assertividade desc)
        .sort((a, b) => (b.personalityTraits['assertividade'] ?? 5) - (a.personalityTraits['assertividade'] ?? 5));

      const room = orgRoom(org.id);
      const orchestrator = new MeetingOrchestrator(meeting, agents, user, {
        message: (m) => io.to(room).emit('meeting:message', m),
        thinking: (agentId, agentName) => io.to(room).emit('meeting:thinking', { meetingId, agentId, agentName }),
        round: (round, totalRounds) => io.to(room).emit('meeting:round', { meetingId, round, totalRounds }),
        usage: (tokensIn, tokensOut, cumulativeTokens, cumulativeCostUsd) =>
          io.to(room).emit('meeting:usage', { meetingId, tokensIn, tokensOut, cumulativeTokens, cumulativeCostUsd }),
        minutes: (m) => io.to(room).emit('meeting:minutes', m),
        finished: () => {
          io.to(room).emit('meeting:finished', { meetingId });
          activeMeetings.delete(meetingId);
        },
        error: (message) => io.to(room).emit('meeting:error', { meetingId, error: message }),
      });
      activeMeetings.set(meetingId, orchestrator);
      io.to(room).emit('meeting:started', { meetingId });
      void orchestrator.run();
    });

    socket.on('meeting:intervene', ({ meetingId, content }) => {
      const orch = activeMeetings.get(meetingId);
      if (orch && content.trim()) orch.intervene(content.trim());
    });

    socket.on('meeting:stop', ({ meetingId }) => {
      activeMeetings.get(meetingId)?.stop();
    });

    socket.on('disconnect', () => {
      presence.delete(socket.id);
      activity.endSession(user.id);
      socket.to(orgRoom(org.id)).emit('presence:leave', user.id);
    });
  });
}
