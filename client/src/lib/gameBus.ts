import Phaser from 'phaser';
import type { Agent, MeetingMessage, SeatAssignment } from '@evoluze/shared';

/**
 * Ponte de eventos entre a cena Phaser e a UI React.
 * React → Phaser: comandos (sentar agentes, mostrar balão, voltar às mesas).
 * Phaser → React: sinais (proximidade, interagir, todos sentados).
 */
export interface GameBusEvents {
  // Phaser -> React
  'proximity:change': (agentId: string | null) => void;
  'player:interact': (agentId: string) => void;
  'meeting:allSeated': (meetingId: string) => void;
  'player:move': (payload: { x: number; y: number; facing: string; moving: boolean }) => void;

  // React -> Phaser
  'meeting:seat': (payload: { meetingId: string; seats: SeatAssignment[] }) => void;
  'meeting:bubble': (msg: MeetingMessage) => void;
  'meeting:thinking': (agentId: string) => void;
  'meeting:return': () => void;
  'input:lock': (locked: boolean) => void;
  'agent:add': (agent: Agent) => void;
}

class TypedBus extends Phaser.Events.EventEmitter {
  emitT<K extends keyof GameBusEvents>(event: K, ...args: Parameters<GameBusEvents[K]>) {
    return this.emit(event as string, ...args);
  }
  onT<K extends keyof GameBusEvents>(event: K, fn: GameBusEvents[K], ctx?: unknown) {
    return this.on(event as string, fn as (...a: unknown[]) => void, ctx);
  }
  offT<K extends keyof GameBusEvents>(event: K, fn: GameBusEvents[K]) {
    return this.off(event as string, fn as (...a: unknown[]) => void);
  }
}

export const gameBus = new TypedBus();
