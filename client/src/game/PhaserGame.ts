import Phaser from 'phaser';
import type { Bootstrap } from '../lib/api';
import { BootScene } from './scenes/BootScene';
import { OfficeScene } from './scenes/OfficeScene';

export function createGame(parent: HTMLElement, boot: Bootstrap): Phaser.Game {
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    backgroundColor: '#0b1220',
    pixelArt: true,
    scale: {
      mode: Phaser.Scale.RESIZE,
      width: '100%',
      height: '100%',
    },
    physics: {
      default: 'arcade',
      arcade: { gravity: { x: 0, y: 0 }, debug: false },
    },
    scene: [BootScene, OfficeScene],
  });
  game.scene.start('BootScene', { boot });
  return game;
}
