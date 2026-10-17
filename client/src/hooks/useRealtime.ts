import { useEffect } from 'react';
import { getSocket } from '../lib/socket';
import { gameBus } from '../lib/gameBus';
import { useStore } from '../store/useStore';
import type { Dir } from '../game/entities/GridCharacter';

/**
 * Realtime: conecta o Socket.io, espelha a presença dos outros usuários
 * dentro da cena Phaser e envia a posição do jogador local.
 */
export function useRealtime() {
  const boot = useStore((s) => s.boot);

  useEffect(() => {
    if (!boot?.online) return;

    const socket = getSocket();
    socket.connect();

    socket.on('connect', () => {
      useStore.getState().setConnected(true);
      socket.emit('presence:join', { userId: boot.user.id });
    });
    socket.on('disconnect', () => useStore.getState().setConnected(false));

    socket.on('presence:sync', (entities) => {
      useStore.getState().setPresence(entities);
      for (const e of entities) {
        if (e.id === boot.user.id) continue;
        gameBus.emitT('remote:update', {
          id: e.id,
          name: e.name,
          look: e.look,
          tileX: e.tileX,
          tileY: e.tileY,
          facing: e.facing as Dir,
        });
      }
    });

    socket.on('presence:update', (e) => {
      useStore.getState().upsertPresence(e);
      if (e.id === boot.user.id) return;
      gameBus.emitT('remote:update', {
        id: e.id,
        name: e.name,
        look: e.look,
        tileX: e.tileX,
        tileY: e.tileY,
        facing: e.facing as Dir,
      });
    });

    socket.on('presence:leave', (id) => {
      useStore.getState().removePresence(id);
      gameBus.emitT('remote:leave', id);
    });

    const onMove = (p: { tileX: number; tileY: number; facing: Dir }) =>
      socket.emit('presence:move', { tileX: p.tileX, tileY: p.tileY, facing: p.facing });
    gameBus.onT('player:move', onMove);

    return () => {
      gameBus.offT('player:move', onMove);
      socket.removeAllListeners();
      socket.disconnect();
    };
  }, [boot]);
}
