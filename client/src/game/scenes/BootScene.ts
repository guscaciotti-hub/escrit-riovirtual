import Phaser from 'phaser';
import type { Bootstrap } from '../../lib/api';

/** Carrega a arte (tileset + personagens) e o mapa Tiled. */
export class BootScene extends Phaser.Scene {
  constructor() {
    super('BootScene');
  }

  init(data: { boot: Bootstrap }) {
    this.registry.set('boot', data.boot);
  }

  preload() {
    const boot = this.registry.get('boot') as Bootstrap;
    const base = import.meta.env.BASE_URL;

    this.load.image('tiles', `${base}assets/tilesets/office.png`);
    this.load.spritesheet('people', `${base}assets/characters/people.png`, {
      frameWidth: 24,
      frameHeight: 32,
    });

    // Build single-file: mapa embutido para dispensar o fetch.
    const embedded = (window as unknown as { __OFFICE_MAP__?: unknown }).__OFFICE_MAP__;
    if (embedded) this.cache.json.add('office-map', embedded);
    else this.load.json('office-map', boot.map.tmjUrl);
  }

  create() {
    this.scene.start('OfficeScene', { boot: this.registry.get('boot') });
  }
}
