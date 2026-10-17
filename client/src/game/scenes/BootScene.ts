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

    // No build single-file a arte vem embutida em base64 (não há arquivo para buscar).
    const art = (window as unknown as { __OFFICE_ART__?: { tiles: string; people: string } })
      .__OFFICE_ART__;
    const tilesUrl = art?.tiles ?? `${base}assets/tilesets/office.png`;
    const peopleUrl = art?.people ?? `${base}assets/characters/people.png`;

    // 'tiles' alimenta o tilemap; 'tiles-frames' permite desenhar um tile
    // avulso como sprite (usado no furniture_top, que precisa de y-sorting).
    this.load.image('tiles', tilesUrl);
    this.load.spritesheet('tiles-frames', tilesUrl, { frameWidth: 32, frameHeight: 32 });
    this.load.spritesheet('people', peopleUrl, { frameWidth: 24, frameHeight: 32 });

    // Build single-file: mapa embutido para dispensar o fetch.
    const embedded = (window as unknown as { __OFFICE_MAP__?: unknown }).__OFFICE_MAP__;
    if (embedded) this.cache.json.add('office-map', embedded);
    else this.load.json('office-map', boot.map.tmjUrl);
  }

  create() {
    this.scene.start('OfficeScene', { boot: this.registry.get('boot') });
  }
}
