import { useEffect } from 'react';
import type { CreateMeetingInput } from '@evoluze/shared';
import { getSocket } from '../lib/socket';
import { gameBus } from '../lib/gameBus';
import { useStore } from '../store/useStore';

/**
 * Fio condutor do realtime: conecta Socket.io, escuta eventos de reunião e
 * presença, e casa os sinais do jogo (Phaser) com o servidor e o estado React.
 */
export function useRealtime() {
  const boot = useStore((s) => s.boot);

  useEffect(() => {
    if (!boot) return;
    const s = useStore.getState();

    // ---- Sinais Phaser -> React/estado ----
    const onProximity = (agentId: string | null) => useStore.getState().setNearbyAgent(agentId);
    const onInteract = (agentId: string) => {
      const st = useStore.getState();
      if (st.meetingPhase === 'running' || st.chatAgentId) return;
      st.openChat(agentId);
      gameBus.emitT('input:lock', true);
    };
    gameBus.onT('proximity:change', onProximity);
    gameBus.onT('player:interact', onInteract);

    if (!boot.online) {
      return () => {
        gameBus.offT('proximity:change', onProximity);
        gameBus.offT('player:interact', onInteract);
      };
    }

    // ---- Socket.io ----
    const socket = getSocket();
    socket.connect();

    socket.on('connect', () => {
      useStore.getState().setConnected(true);
      socket.emit('presence:join', { userId: boot.user.id });
    });
    socket.on('disconnect', () => useStore.getState().setConnected(false));

    socket.on('meeting:convened', ({ meeting, seats }) => {
      useStore.getState().onConvened(meeting, seats);
      gameBus.emitT('meeting:seat', { meetingId: meeting.id, seats });
    });
    socket.on('meeting:started', () => {
      useStore.getState().onMeetingStarted();
      gameBus.emitT('input:lock', true);
    });
    socket.on('meeting:message', (msg) => {
      useStore.getState().pushMeetingMessage(msg);
      gameBus.emitT('meeting:bubble', msg);
    });
    socket.on('meeting:thinking', ({ agentId }) => {
      useStore.getState().setThinking(agentId);
      gameBus.emitT('meeting:thinking', agentId);
    });
    socket.on('meeting:round', ({ round, totalRounds }) => useStore.getState().setRound(round, totalRounds));
    socket.on('meeting:usage', ({ cumulativeTokens, cumulativeCostUsd }) =>
      useStore.getState().setUsage(cumulativeTokens, cumulativeCostUsd),
    );
    socket.on('meeting:minutes', (m) => useStore.getState().setMinutes(m));
    socket.on('meeting:finished', () => {
      useStore.getState().setMeetingPhase('finished');
      gameBus.emitT('input:lock', false);
      gameBus.emitT('meeting:return');
    });
    socket.on('meeting:error', ({ error }) => {
      useStore.getState().setMeetingError(error);
      gameBus.emitT('input:lock', false);
    });

    // Player entrou na sala e agentes sentados -> inicia
    const onAllSeated = (meetingId: string) => socket.emit('meeting:ready', { meetingId });
    const onPlayerMove = (p: { x: number; y: number; facing: string; moving: boolean }) =>
      socket.emit('presence:move', { x: p.x, y: p.y, facing: p.facing as never, moving: p.moving });
    gameBus.onT('meeting:allSeated', onAllSeated);
    gameBus.onT('player:move', onPlayerMove);

    return () => {
      gameBus.offT('proximity:change', onProximity);
      gameBus.offT('player:interact', onInteract);
      gameBus.offT('meeting:allSeated', onAllSeated);
      gameBus.offT('player:move', onPlayerMove);
      socket.removeAllListeners();
      socket.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boot]);
}

/** Convoca reunião via socket. Retorna Promise com meetingId ou erro. */
export function convene(input: CreateMeetingInput): Promise<{ meetingId?: string; error?: string }> {
  return new Promise((resolve) => {
    const socket = getSocket();
    if (!socket.connected) return resolve({ error: 'Sem conexão com o servidor.' });
    socket.emit('meeting:convene', input, (res) => resolve(res));
  });
}

export function intervene(meetingId: string, content: string) {
  getSocket().emit('meeting:intervene', { meetingId, content });
}
