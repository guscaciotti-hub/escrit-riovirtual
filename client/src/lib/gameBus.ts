import Phaser from 'phaser';
import type { Dir } from '../game/entities/GridCharacter';

/** Ponte de eventos entre a cena Phaser e a UI React. */
export interface GameBusEvents {
  // Phaser -> React
  'player:move': (p: { tileX: number; tileY: number; facing: Dir }) => void;

  // React -> Phaser
  'remote:update': (p: {
    id: string;
    name: string;
    look: number;
    tileX: number;
    tileY: number;
    facing: Dir;
  }) => void;
  'remote:leave': (id: string) => void;
  'input:lock': (locked: boolean) => void;
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
