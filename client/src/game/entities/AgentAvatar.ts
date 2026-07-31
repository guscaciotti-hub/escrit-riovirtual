import Phaser from 'phaser';
import type { Agent } from '@evoluze/shared';
import { Character, type Facing } from './Character';
import { CHARACTER, DEPTH } from '../config';

/** Avatar de um agente: idle na mesa, caminha até assentos, mostra balão de fala. */
export class AgentAvatar {
  char: Character;
  readonly agentId: string;
  readonly homeX: number;
  readonly homeY: number;
  private bubble?: Phaser.GameObjects.Container;
  private bubbleText?: Phaser.GameObjects.Text;
  private typeEvent?: Phaser.Time.TimerEvent;
  private hideEvent?: Phaser.Time.TimerEvent;
  private thinkingTween?: Phaser.Tweens.Tween;

  constructor(
    public scene: Phaser.Scene,
    agent: Agent,
  ) {
    this.agentId = agent.id;
    this.homeX = agent.spawnX;
    this.homeY = agent.spawnY;
    const tint = Phaser.Display.Color.HexStringToColor(agent.avatarConfig.tint ?? '#888888').color;
    this.char = new Character(scene, agent.spawnX, agent.spawnY, {
      name: agent.name.split(' ')[0],
      tint,
    });
  }

  get x() {
    return this.char.x;
  }
  get y() {
    return this.char.y;
  }

  /** Caminha por uma sequência de pontos (centro de tiles, em px). */
  walkPath(points: Array<{ x: number; y: number }>, onArrive?: () => void) {
    if (points.length === 0) {
      onArrive?.();
      return;
    }
    this.char.setMoving(true);
    let i = 0;
    const step = () => {
      if (i >= points.length) {
        this.char.setMoving(false);
        onArrive?.();
        return;
      }
      const p = points[i++];
      const dx = p.x - this.char.x;
      const dy = p.y - this.char.y;
      if (Math.abs(dx) > Math.abs(dy)) this.char.setFacing(dx > 0 ? 'right' : 'left');
      else if (Math.abs(dy) > 0) this.char.setFacing(dy > 0 ? 'down' : 'up');
      const dist = Math.hypot(dx, dy);
      this.scene.tweens.add({
        targets: this.char.container,
        x: p.x,
        y: p.y,
        duration: Math.max(60, (dist / CHARACTER.speed) * 1000),
        ease: 'Linear',
        onUpdate: () => this.char.container.setDepth(DEPTH.entitiesBase + this.char.container.y),
        onComplete: step,
      });
    };
    step();
  }

  faceTable(seatX: number) {
    // vira para o centro da mesa (x ~ 28.5 tiles)
    const center = 28.5 * 32;
    this.char.setFacing(seatX < center ? 'right' : 'left');
  }

  showThinking() {
    this.ensureBubble();
    this.stopTimers();
    this.bubbleText!.setText('…');
    this.layoutBubble();
    this.bubble!.setVisible(true).setAlpha(1);
    this.thinkingTween = this.scene.tweens.add({
      targets: this.bubble,
      alpha: 0.4,
      duration: 500,
      yoyo: true,
      repeat: -1,
    });
  }

  /** Balão com efeito typewriter. */
  showBubble(full: string) {
    this.ensureBubble();
    this.stopTimers();
    this.thinkingTween?.remove();
    this.bubble!.setVisible(true).setAlpha(1);
    const clipped = full.length > 220 ? full.slice(0, 217) + '…' : full;
    let n = 0;
    this.bubbleText!.setText('');
    this.typeEvent = this.scene.time.addEvent({
      delay: 18,
      repeat: clipped.length - 1,
      callback: () => {
        n++;
        this.bubbleText!.setText(clipped.slice(0, n));
        this.layoutBubble();
      },
    });
    // esconde após um tempo proporcional
    this.hideEvent = this.scene.time.delayedCall(Math.min(9000, 2500 + clipped.length * 45), () => {
      this.bubble?.setVisible(false);
    });
  }

  private stopTimers() {
    this.typeEvent?.remove();
    this.hideEvent?.remove();
    this.thinkingTween?.remove();
  }

  private ensureBubble() {
    if (this.bubble) return;
    const text = this.scene.add.text(0, 0, '', {
      fontFamily: 'Inter, sans-serif',
      fontSize: '11px',
      color: '#0b1220',
      wordWrap: { width: 150 },
      align: 'left',
    });
    const bg = this.scene.add.graphics();
    this.bubble = this.scene.add.container(0, -CHARACTER.bodyH / 2 - 44, [bg, text]);
    this.bubble.setDepth(DEPTH.bubble);
    this.bubbleText = text;
    (this.bubble as unknown as { bg: Phaser.GameObjects.Graphics }).bg = bg;
    this.char.container.add(this.bubble);
    this.bubble.setVisible(false);
  }

  private layoutBubble() {
    if (!this.bubble || !this.bubbleText) return;
    const bg = (this.bubble as unknown as { bg: Phaser.GameObjects.Graphics }).bg;
    const tw = this.bubbleText.width;
    const th = this.bubbleText.height;
    const padX = 8;
    const padY = 6;
    const w = tw + padX * 2;
    const h = th + padY * 2;
    this.bubbleText.setPosition(-w / 2 + padX, -h / 2 + padY);
    bg.clear();
    bg.fillStyle(0xffffff, 0.96);
    bg.fillRoundedRect(-w / 2, -h / 2, w, h, 8);
    bg.fillTriangle(-5, h / 2 - 1, 5, h / 2 - 1, 0, h / 2 + 7);
    // reposiciona acima da cabeça
    this.bubble.setY(-CHARACTER.bodyH / 2 - 24 - h / 2);
  }

  returnHome(onArrive?: () => void) {
    this.walkPath([{ x: this.homeX, y: this.homeY }], () => {
      this.char.setFacing('down');
      onArrive?.();
    });
  }

  hideBubble() {
    this.stopTimers();
    this.bubble?.setVisible(false);
  }
}
