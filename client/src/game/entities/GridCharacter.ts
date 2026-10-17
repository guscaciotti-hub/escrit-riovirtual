import Phaser from 'phaser';

export type Dir = 'down' | 'left' | 'right' | 'up';
export const DIR_ROW: Record<Dir, number> = { down: 0, left: 1, right: 2, up: 3 };

export const TILE = 32;
export const STEP_MS = 170; // duração de um passo entre tiles

/**
 * Personagem com movimento preso à grade, no estilo dos Pokémon de GBA:
 * anda de tile em tile com tween, nunca para "no meio" de um tile.
 */
export class GridCharacter {
  sprite: Phaser.GameObjects.Sprite;
  label?: Phaser.GameObjects.Container;
  tileX: number;
  tileY: number;
  facing: Dir = 'down';
  moving = false;

  constructor(
    public scene: Phaser.Scene,
    tileX: number,
    tileY: number,
    public look: number,
    name?: string,
    isSelf = false,
  ) {
    this.tileX = tileX;
    this.tileY = tileY;
    this.sprite = scene.add
      .sprite(tileX * TILE + TILE / 2, tileY * TILE + TILE, 'people')
      .setOrigin(0.5, 1);
    this.sprite.play(this.animKey('idle'));
    this.updateDepth();
    if (name) this.label = this.buildLabel(name, isSelf);
  }

  private animKey(kind: 'idle' | 'walk') {
    return `p${this.look}-${this.facing}-${kind}`;
  }

  private buildLabel(name: string, isSelf: boolean) {
    const text = this.scene.add
      .text(0, 0, name, {
        fontFamily: 'Inter, system-ui, sans-serif',
        fontSize: '10px',
        color: '#ffffff',
        resolution: 2,
      })
      .setOrigin(0.5, 0.5);
    const w = text.width + 16;
    const bg = this.scene.add.graphics();
    bg.fillStyle(isSelf ? 0x1f8f86 : 0x2b2118, 0.92);
    bg.fillRoundedRect(-w / 2, -8, w, 16, 8);
    bg.lineStyle(1, 0x000000, 0.35);
    bg.strokeRoundedRect(-w / 2, -8, w, 16, 8);
    const c = this.scene.add.container(this.sprite.x, this.sprite.y - 36, [bg, text]);
    c.setDepth(100000);
    return c;
  }

  setFacing(dir: Dir) {
    if (this.facing === dir) return;
    this.facing = dir;
    this.sprite.play(this.animKey(this.moving ? 'walk' : 'idle'), true);
  }

  /** Inicia um passo para o tile vizinho. Resolve quando o passo termina. */
  step(dir: Dir, onDone?: () => void) {
    if (this.moving) return;
    this.setFacing(dir);
    const d = { down: [0, 1], up: [0, -1], left: [-1, 0], right: [1, 0] }[dir];
    this.tileX += d[0];
    this.tileY += d[1];
    this.moving = true;
    this.sprite.play(this.animKey('walk'), true);
    this.scene.tweens.add({
      targets: this.sprite,
      x: this.tileX * TILE + TILE / 2,
      y: this.tileY * TILE + TILE,
      duration: STEP_MS,
      ease: 'Linear',
      onUpdate: () => this.syncLabel(),
      onComplete: () => {
        this.moving = false;
        this.syncLabel();
        this.updateDepth();
        onDone?.();
      },
    });
  }

  stopWalking() {
    if (this.moving) return;
    this.sprite.play(this.animKey('idle'), true);
  }

  /** Teleporte sem animação (sincronização de outro jogador que ficou longe). */
  snapTo(tileX: number, tileY: number) {
    this.tileX = tileX;
    this.tileY = tileY;
    this.sprite.setPosition(tileX * TILE + TILE / 2, tileY * TILE + TILE);
    this.syncLabel();
    this.updateDepth();
  }

  private syncLabel() {
    this.label?.setPosition(this.sprite.x, this.sprite.y - 36);
  }

  private updateDepth() {
    this.sprite.setDepth(this.sprite.y); // y-sorting: quem está mais abaixo aparece à frente
  }

  destroy() {
    this.sprite.destroy();
    this.label?.destroy();
  }
}

/** Registra as animações de todos os visuais. Chamar uma vez por cena. */
export function registerPeopleAnims(scene: Phaser.Scene, looks: number, framesPerDir = 3) {
  const cols = looks * framesPerDir;
  for (let v = 0; v < looks; v++) {
    for (const dir of ['down', 'left', 'right', 'up'] as Dir[]) {
      const base = DIR_ROW[dir] * cols + v * framesPerDir;
      if (!scene.anims.exists(`p${v}-${dir}-idle`)) {
        scene.anims.create({
          key: `p${v}-${dir}-idle`,
          frames: [{ key: 'people', frame: base }],
          frameRate: 1,
        });
        scene.anims.create({
          key: `p${v}-${dir}-walk`,
          // 0,1,0,2 dá o vai-e-vem clássico de 4 tempos
          frames: [base, base + 1, base, base + 2].map((f) => ({ key: 'people', frame: f })),
          frameRate: 8,
          repeat: -1,
        });
      }
    }
  }
}
