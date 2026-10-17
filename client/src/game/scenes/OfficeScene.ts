import Phaser from 'phaser';
import type { Bootstrap } from '../../lib/api';
import { gameBus } from '../../lib/gameBus';
import { GridCharacter, TILE, registerPeopleAnims, type Dir } from '../entities/GridCharacter';

interface TmjLayer {
  name: string;
  type: string;
  data?: number[];
  objects?: Array<Record<string, unknown>>;
}
interface Tmj {
  width: number;
  height: number;
  tilewidth: number;
  layers: TmjLayer[];
}

/** GIDs que bloqueiam passagem: parede, mesa, mesa de reunião. */
const BLOCKING = new Set([2, 3, 4]);
const DELTA: Record<Dir, [number, number]> = {
  up: [0, -1],
  down: [0, 1],
  left: [-1, 0],
  right: [1, 0],
};

export class OfficeScene extends Phaser.Scene {
  private boot!: Bootstrap;
  private player!: GridCharacter;
  private others = new Map<string, GridCharacter>();
  private blocked: boolean[][] = [];
  private keys!: Record<string, Phaser.Input.Keyboard.Key>;
  private locked = false;

  constructor() {
    super('OfficeScene');
  }

  init(data: { boot: Bootstrap }) {
    this.boot = data.boot;
  }

  create() {
    const tmj = this.cache.json.get('office-map') as Tmj;
    const W = tmj.width;
    const H = tmj.height;

    this.blocked = Array.from({ length: H }, () => new Array<boolean>(W).fill(false));
    registerPeopleAnims(this, 6);

    const layerOf = (name: string) => tmj.layers.find((l) => l.name === name && l.data)?.data;

    /** Converte o array plano de GIDs num grid de índices do tileset. */
    const grid = (data: number[] | undefined) => {
      const out: number[][] = [];
      for (let y = 0; y < H; y++) {
        const row: number[] = [];
        for (let x = 0; x < W; x++) {
          const gid = data?.[y * W + x] ?? 0;
          row.push(gid === 0 ? -1 : gid - 1); // -1 = vazio no Phaser
        }
        out.push(row);
      }
      return out;
    };

    // --- camadas de piso e móveis ---
    for (const [name, depth] of [
      ['floor', 0],
      ['walls', 10],
      ['furniture', 10],
    ] as const) {
      const data = layerOf(name);
      if (!data) continue;
      const map = this.make.tilemap({ data: grid(data), tileWidth: TILE, tileHeight: TILE });
      const tileset = map.addTilesetImage('tiles')!;
      map.createLayer(0, tileset, 0, 0)!.setDepth(depth);

      if (name !== 'floor') {
        for (let y = 0; y < H; y++)
          for (let x = 0; x < W; x++) {
            if (BLOCKING.has(data[y * W + x])) this.blocked[y][x] = true;
          }
      }
    }

    // --- furniture_top: sprites individuais para o y-sorting funcionar ---
    const top = layerOf('furniture_top');
    if (top) {
      for (let y = 0; y < H; y++)
        for (let x = 0; x < W; x++) {
          const gid = top[y * W + x];
          if (!gid) continue;
          this.add
            .image(x * TILE + TILE / 2, y * TILE + TILE, 'tiles-frames', gid - 1)
            .setOrigin(0.5, 1)
            .setDepth((y + 1) * TILE);
        }
    }

    // --- player ---
    const spawn = this.boot.map.playerSpawn;
    this.player = new GridCharacter(
      this,
      spawn.x,
      spawn.y,
      this.boot.user.look ?? 0,
      this.boot.user.name.split(' ')[0],
      true,
    );

    // --- câmera: zoom inteiro, segue o jogador ---
    this.cameras.main.setBounds(0, 0, W * TILE, H * TILE);
    this.cameras.main.startFollow(this.player.sprite, true, 0.12, 0.12);
    this.cameras.main.setZoom(2);
    this.cameras.main.setBackgroundColor(0x1a1410);
    this.cameras.main.roundPixels = true;

    // --- input ---
    const kb = this.input.keyboard!;
    this.keys = kb.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT') as Record<string, Phaser.Input.Keyboard.Key>;

    gameBus.onT('input:lock', this.onLock, this);
    gameBus.onT('remote:update', this.onRemote, this);
    gameBus.onT('remote:leave', this.onRemoteLeave, this);

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      gameBus.offT('input:lock', this.onLock);
      gameBus.offT('remote:update', this.onRemote);
      gameBus.offT('remote:leave', this.onRemoteLeave);
    });

    this.emitPresence();
  }

  private onLock = (locked: boolean) => {
    this.locked = locked;
  };

  private onRemote = (p: {
    id: string;
    name: string;
    look: number;
    tileX: number;
    tileY: number;
    facing: Dir;
  }) => {
    if (p.id === this.boot.user.id) return;
    let ch = this.others.get(p.id);
    if (!ch) {
      ch = new GridCharacter(this, p.tileX, p.tileY, p.look, p.name.split(' ')[0]);
      this.others.set(p.id, ch);
      return;
    }
    const dx = p.tileX - ch.tileX;
    const dy = p.tileY - ch.tileY;
    // um tile de diferença: anda. Mais que isso: teleporta (ficou dessincronizado).
    if (!ch.moving && Math.abs(dx) + Math.abs(dy) === 1) {
      ch.step(dx === 1 ? 'right' : dx === -1 ? 'left' : dy === 1 ? 'down' : 'up');
    } else if (!ch.moving && (dx !== 0 || dy !== 0)) {
      ch.snapTo(p.tileX, p.tileY);
    } else if (!ch.moving) {
      ch.setFacing(p.facing);
      ch.stopWalking();
    }
  };

  private onRemoteLeave = (id: string) => {
    this.others.get(id)?.destroy();
    this.others.delete(id);
  };

  private walkable(x: number, y: number) {
    if (y < 0 || x < 0 || y >= this.blocked.length || x >= this.blocked[0].length) return false;
    if (this.blocked[y][x]) return false;
    for (const o of this.others.values()) if (o.tileX === x && o.tileY === y) return false;
    return true;
  }

  private emitPresence() {
    gameBus.emitT('player:move', {
      tileX: this.player.tileX,
      tileY: this.player.tileY,
      facing: this.player.facing,
    });
  }

  private heldDir(): Dir | null {
    const k = this.keys;
    if (k.A.isDown || k.LEFT.isDown) return 'left';
    if (k.D.isDown || k.RIGHT.isDown) return 'right';
    if (k.W.isDown || k.UP.isDown) return 'up';
    if (k.S.isDown || k.DOWN.isDown) return 'down';
    return null;
  }

  update() {
    if (this.locked || this.player.moving) return;
    const dir = this.heldDir();
    if (!dir) {
      this.player.stopWalking();
      return;
    }
    const [dx, dy] = DELTA[dir];
    const tx = this.player.tileX + dx;
    const ty = this.player.tileY + dy;
    if (this.walkable(tx, ty)) {
      this.player.step(dir, () => this.emitPresence());
      this.emitPresence();
    } else {
      // esbarrou: só vira de frente para o obstáculo, como nos jogos
      this.player.setFacing(dir);
      this.player.stopWalking();
    }
  }
}
