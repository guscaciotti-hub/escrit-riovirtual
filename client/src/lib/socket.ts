import { io, type Socket } from 'socket.io-client';
import type { ClientToServerEvents, ServerToClientEvents } from '@evoluze/shared';
import { SERVER_URL, getToken } from './api';

export type AppSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

let socket: AppSocket | null = null;

export function getSocket(): AppSocket {
  if (!socket) {
    socket = io(SERVER_URL, {
      auth: (cb) => cb({ token: getToken() ?? '' }),
      autoConnect: false,
      reconnection: true,
      reconnectionAttempts: 3,
      timeout: 4000,
    });
  }
  return socket;
}
