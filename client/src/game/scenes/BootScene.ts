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
    // Build single-file / preview: mapa embutido em window.__OFFICE_MAP__
    // (evita fetch quando não há servidor de assets). Caso contrário, carrega o .tmj.
    const embedded = (window as unknown as { __OFFICE_MAP__?: unknown }).__OFFICE_MAP__;
    if (embedded) {
      this.cache.json.add('office-map', embedded);
      return;
    }
    this.load.json('office-map', boot.map.tmjUrl);
  }

  create() {
    const boot = this.registry.get('boot') as Bootstrap;
    this.scene.start('OfficeScene', { boot });
  }
}
