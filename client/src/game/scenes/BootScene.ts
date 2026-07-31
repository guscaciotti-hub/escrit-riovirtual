import Phaser from 'phaser';
import type { Bootstrap } from '../../lib/api';

/** Carrega o mapa Tiled (.tmj) e passa o bootstrap adiante para a OfficeScene. */
export class BootScene extends Phaser.Scene {
  constructor() {
    super('BootScene');
  }

  init(data: { boot: Bootstrap }) {
    this.registry.set('boot', data.boot);
  }

  preload() {
    const boot = this.registry.get('boot') as Bootstrap;
    this.load.json('office-map', boot.map.tmjUrl);
  }

  create() {
    const boot = this.registry.get('boot') as Bootstrap;
    this.scene.start('OfficeScene', { boot });
  }
}
