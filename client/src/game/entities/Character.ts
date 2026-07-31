import Phaser from 'phaser';
import { CHARACTER, DEPTH } from '../config';

export type Facing = 'up' | 'down' | 'left' | 'right';

export interface CharacterOpts {
  name: string;
  tint: number;
  isPlayer?: boolean;
  status?: string;
}

/**
 * Personagem placeholder: corpo arredondado colorido + cabeça + indicador de
 * direção, com balão de nome estilo Gather (pill preta, texto branco, status dot).
 * Animação idle (respiração) e bob de caminhada. Trocável por spritesheet real.
 */
export class Character {
  container: Phaser.GameObjects.Container;
  private body: Phaser.GameObjects.Graphics;
  private pointer: Phaser.GameObjects.Graphics;
  private namePill: Phaser.GameObjects.Container;
  private statusDot: Phaser.GameObjects.Arc;
  private facing: Facing = 'down';
  private moving = false;
  private breathTween?: Phaser.Tweens.Tween;
  private bobTween?: Phaser.Tweens.Tween;
  private inner: Phaser.GameObjects.Container;

  constructor(
    public scene: Phaser.Scene,
    x: number,
    y: number,
    private opts: CharacterOpts,
  ) {
    this.container = scene.add.container(x, y);

    // inner container agrupa corpo+cabeça para aplicar respiração/bob sem mexer no pill
    this.inner = scene.add.container(0, 0);
    this.body = scene.add.graphics();
    this.pointer = scene.add.graphics();
    this.drawBody();
    this.inner.add([this.body, this.pointer]);

    this.namePill = this.buildNamePill();
    this.statusDot = scene.add.circle(0, 0, 3, 0x31d158);

    this.container.add([this.inner, this.namePill]);
    this.setFacing('down');

    // Respiração idle
    this.breathTween = scene.tweens.add({
      targets: this.inner,
      scaleY: 1.04,
      duration: 1400,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.inOut',
    });

    this.container.setDepth(DEPTH.entitiesBase + y);
  }

  private drawBody() {
    const { bodyW, bodyH } = CHARACTER;
    const g = this.body;
    g.clear();
    // sombra
    g.fillStyle(0x000000, 0.25);
    g.fillEllipse(0, bodyH / 2 + 2, bodyW * 0.9, 7);
    // corpo
    g.fillStyle(this.opts.tint, 1);
    g.fillRoundedRect(-bodyW / 2, -bodyH / 2, bodyW, bodyH, 7);
    g.lineStyle(2, 0x0b1220, 0.8);
    g.strokeRoundedRect(-bodyW / 2, -bodyH / 2, bodyW, bodyH, 7);
    // cabeça
    g.fillStyle(0xf1d9b5, 1);
    g.fillCircle(0, -bodyH / 2 - 2, 8);
    g.lineStyle(2, 0x0b1220, 0.7);
    g.strokeCircle(0, -bodyH / 2 - 2, 8);
  }

  private buildNamePill(): Phaser.GameObjects.Container {
    const label = this.opts.name;
    const text = this.scene.add
      .text(6, 0, label, {
        fontFamily: 'Inter, sans-serif',
        fontSize: '11px',
        color: '#ffffff',
      })
      .setOrigin(0, 0.5);
    const padX = 8;
    const w = text.width + padX * 2 + 10;
    const h = 18;
    const bg = this.scene.add.graphics();
    bg.fillStyle(0x0b1220, 0.85);
    bg.fillRoundedRect(-w / 2, -h / 2, w, h, 9);
    const dot = this.scene.add.circle(-w / 2 + 9, 0, 3, 0x31d158);
    this.statusDot = dot;
    text.setPosition(-w / 2 + 16, 0);

    const pill = this.scene.add.container(0, -CHARACTER.bodyH / 2 - 22, [bg, dot, text]);
    return pill;
  }

  setFacing(dir: Facing) {
    this.facing = dir;
    const g = this.pointer;
    g.clear();
    g.fillStyle(0x0b1220, 0.9);
    const r = 4;
    const cy = -CHARACTER.bodyH / 2 - 2; // altura da cabeça
    const map: Record<Facing, [number, number]> = {
      down: [0, cy + 4],
      up: [0, cy - 4],
      left: [-4, cy],
      right: [4, cy],
    };
    const [ex, ey] = map[dir];
    g.fillCircle(ex - 2, ey, r - 2);
    g.fillCircle(ex + 2, ey, r - 2);
  }

  setMoving(moving: boolean) {
    if (moving === this.moving) return;
    this.moving = moving;
    if (moving) {
      this.bobTween?.remove();
      this.bobTween = this.scene.tweens.add({
        targets: this.inner,
        y: -2,
        duration: 180,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.inOut',
      });
    } else {
      this.bobTween?.remove();
      this.bobTween = undefined;
      this.inner.y = 0;
    }
  }

  setStatus(color: number) {
    this.statusDot.setFillStyle(color);
  }

  setPosition(x: number, y: number) {
    this.container.setPosition(x, y);
    this.container.setDepth(DEPTH.entitiesBase + y);
  }

  get x() {
    return this.container.x;
  }
  get y() {
    return this.container.y;
  }

  destroy() {
    this.breathTween?.remove();
    this.bobTween?.remove();
    this.container.destroy();
  }
}
