import Phaser from 'phaser';
import { Character, type Facing } from './Character';
import { CHARACTER } from '../config';
import { gameBus } from '../../lib/gameBus';

/** Player controlado por WASD + setas, com corpo de física para colisão. */
export class Player {
  char: Character;
  body: Phaser.Physics.Arcade.Body;
  private lastEmit = 0;

  constructor(scene: Phaser.Scene, x: number, y: number, name: string, tint: number) {
    this.char = new Character(scene, x, y, { name, tint, isPlayer: true });
    scene.physics.world.enable(this.char.container);
    this.body = this.char.container.body as Phaser.Physics.Arcade.Body;
    const w = CHARACTER.bodyW;
    const h = CHARACTER.bodyH;
    this.body.setSize(w, h);
    this.body.setOffset(-w / 2, -h / 2);
    this.body.setCollideWorldBounds(true);
  }

  get container() {
    return this.char.container;
  }

  update(
    time: number,
    keys: { up: boolean; down: boolean; left: boolean; right: boolean },
    locked: boolean,
  ) {
    const speed = CHARACTER.speed;
    let vx = 0;
    let vy = 0;
    if (!locked) {
      if (keys.left) vx -= 1;
      if (keys.right) vx += 1;
      if (keys.up) vy -= 1;
      if (keys.down) vy += 1;
    }
    const moving = vx !== 0 || vy !== 0;
    if (moving) {
      const len = Math.hypot(vx, vy) || 1;
      this.body.setVelocity((vx / len) * speed, (vy / len) * speed);
      let facing: Facing = 'down';
      if (Math.abs(vx) > Math.abs(vy)) facing = vx > 0 ? 'right' : 'left';
      else facing = vy > 0 ? 'down' : 'up';
      this.char.setFacing(facing);
    } else {
      this.body.setVelocity(0, 0);
    }
    this.char.setMoving(moving);
    // depth por y (ordenação top-down)
    this.char.container.setDepth(10 + this.char.container.y);

    // Emite posição no máximo ~12x/s
    if (time - this.lastEmit > 80) {
      this.lastEmit = time;
      gameBus.emitT('player:move', {
        x: this.char.container.x,
        y: this.char.container.y,
        facing: this.currentFacing(),
        moving,
      });
    }
  }

  private currentFacing(): string {
    return 'down';
  }

  get tileX() {
    return Math.floor(this.char.container.x / 32);
  }
  get tileY() {
    return Math.floor(this.char.container.y / 32);
  }
}
