import Phaser from 'phaser';
import type { SeatAssignment } from '@evoluze/shared';
import type { Bootstrap } from '../../lib/api';
import { COLLIDING_GIDS, DEPTH, PROXIMITY_RADIUS_TILES, TILE_COLORS } from '../config';
import { Player } from '../entities/Player';
import { AgentAvatar } from '../entities/AgentAvatar';
import { findPath, type GridPoint } from '../systems/pathfinding';
import { gameBus } from '../../lib/gameBus';

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
  tileheight: number;
  layers: TmjLayer[];
}

export class OfficeScene extends Phaser.Scene {
  private boot!: Bootstrap;
  private tmj!: Tmj;
  private tile = 32;
  private player!: Player;
  private agents = new Map<string, AgentAvatar>();
  private blocked: boolean[][] = [];
  private locked = false;
  private nearbyId: string | null = null;
  private keys!: Record<string, Phaser.Input.Keyboard.Key>;
  private meetingRoomTiles?: { x: number; y: number; w: number; h: number };
  private seatingMeetingId: string | null = null;
  private seatedCount = 0;
  private seatTotal = 0;
  private notifiedSeated = false;

  constructor() {
    super('OfficeScene');
  }

  init(data: { boot: Bootstrap }) {
    this.boot = data.boot;
  }

  create() {
    this.tmj = this.cache.json.get('office-map') as Tmj;
    this.tile = this.tmj.tilewidth;
    const W = this.tmj.width;
    const H = this.tmj.height;
    const worldW = W * this.tile;
    const worldH = H * this.tile;

    this.blocked = Array.from({ length: H }, () => new Array(W).fill(false));

    // ---- Renderiza camadas de tiles como placeholders coloridos ----
    const collisionGroup = this.physics.add.staticGroup();
    for (const layer of this.tmj.layers) {
      if (layer.type !== 'tilelayer' || !layer.data) continue;
      const depth =
        layer.name === 'walls'
          ? DEPTH.walls
          : layer.name === 'furniture'
            ? DEPTH.furniture
            : layer.name === 'furniture_top'
              ? DEPTH.furnitureTop
              : DEPTH.floor;
      const g = this.add.graphics().setDepth(depth);
      for (let i = 0; i < layer.data.length; i++) {
        const gid = layer.data[i];
        if (!gid) continue;
        const x = (i % W) * this.tile;
        const y = Math.floor(i / W) * this.tile;
        const color = TILE_COLORS[gid] ?? 0x333333;
        if (layer.name === 'furniture_top') {
          // planta: base marrom + copa verde
          g.fillStyle(0x3a2c1e, 1);
          g.fillRect(x + 10, y + 18, 12, 12);
          g.fillStyle(color, 1);
          g.fillCircle(x + this.tile / 2, y + 12, 11);
        } else {
          g.fillStyle(color, 1);
          g.fillRect(x, y, this.tile, this.tile);
          if (layer.name === 'walls') {
            g.lineStyle(1, 0x0b1220, 0.5);
            g.strokeRect(x, y, this.tile, this.tile);
          }
          if (layer.name === 'furniture') {
            // detalhe: monitor/tampo
            g.fillStyle(0x0b1220, 0.35);
            g.fillRect(x + 5, y + 5, this.tile - 10, this.tile - 12);
          }
        }
        // Colisão + grid de pathfinding
        if (COLLIDING_GIDS.has(gid)) {
          this.blocked[Math.floor(i / W)][i % W] = true;
          const rect = this.add.rectangle(x + this.tile / 2, y + this.tile / 2, this.tile, this.tile);
          this.physics.add.existing(rect, true);
          collisionGroup.add(rect);
        }
      }
    }

    // Object layer 'zones' → localizar sala de reunião
    const zones = this.tmj.layers.find((l) => l.type === 'objectgroup');
    if (zones?.objects) {
      for (const o of zones.objects) {
        const type = (o.type as string) ?? '';
        const props = (o.properties as Array<{ name: string; value: unknown }>) ?? [];
        const roomId = props.find((p) => p.name === 'roomId')?.value as string | undefined;
        if (type === 'meeting' || roomId === 'room_meeting') {
          this.meetingRoomTiles = {
            x: Math.round((o.x as number) / this.tile),
            y: Math.round((o.y as number) / this.tile),
            w: Math.round((o.width as number) / this.tile),
            h: Math.round((o.height as number) / this.tile),
          };
        }
      }
    }

    // ---- Player ----
    const spawn = this.boot.map.playerSpawn;
    const px = spawn.x * this.tile + this.tile / 2;
    const py = spawn.y * this.tile + this.tile / 2;
    const tint = Phaser.Display.Color.HexStringToColor(this.boot.user.avatarConfig.tint ?? '#00D4C6').color;
    this.player = new Player(this, px, py, this.boot.user.name.split(' ')[0], tint);

    // ---- Agentes ----
    for (const agent of this.boot.agents) {
      this.agents.set(agent.id, new AgentAvatar(this, agent));
    }

    // ---- Física / câmera ----
    this.physics.world.setBounds(0, 0, worldW, worldH);
    this.physics.add.collider(this.player.container, collisionGroup);
    this.cameras.main.setBounds(0, 0, worldW, worldH);
    this.cameras.main.startFollow(this.player.container, true, 0.1, 0.1);
    this.cameras.main.setBackgroundColor(0x0b1220);
    this.cameras.main.setZoom(1.4);

    // ---- Input ----
    const kb = this.input.keyboard!;
    this.keys = kb.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT') as Record<string, Phaser.Input.Keyboard.Key>;
    kb.on('keydown-E', () => {
      if (!this.locked && this.nearbyId) gameBus.emitT('player:interact', this.nearbyId);
    });

    // ---- Ponte com React ----
    gameBus.onT('input:lock', this.onLock, this);
    gameBus.onT('meeting:seat', this.onSeat, this);
    gameBus.onT('meeting:bubble', this.onBubble, this);
    gameBus.onT('meeting:thinking', this.onThinking, this);
    gameBus.onT('meeting:return', this.onReturn, this);
    gameBus.onT('agent:add', this.onAddAgent, this);

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      gameBus.offT('input:lock', this.onLock);
      gameBus.offT('meeting:seat', this.onSeat);
      gameBus.offT('meeting:bubble', this.onBubble);
      gameBus.offT('meeting:thinking', this.onThinking);
      gameBus.offT('meeting:return', this.onReturn);
      gameBus.offT('agent:add', this.onAddAgent);
    });
  }

  private onLock = (locked: boolean) => {
    this.locked = locked;
    if (locked) this.player.update(0, { up: false, down: false, left: false, right: false }, true);
  };

  private onSeat = ({ meetingId, seats }: { meetingId: string; seats: SeatAssignment[] }) => {
    this.seatingMeetingId = meetingId;
    this.seatedCount = 0;
    this.seatTotal = seats.length;
    this.notifiedSeated = false;
    for (const seat of seats) {
      const avatar = this.agents.get(seat.agentId);
      if (!avatar) {
        this.seatTotal--;
        continue;
      }
      const start: GridPoint = {
        x: Math.floor(avatar.x / this.tile),
        y: Math.floor(avatar.y / this.tile),
      };
      const path = findPath(this.blocked, start, { x: seat.x, y: seat.y });
      const pts = (path.length ? path : [{ x: seat.x, y: seat.y }]).map((p) => ({
        x: p.x * this.tile + this.tile / 2,
        y: p.y * this.tile + this.tile / 2,
      }));
      avatar.walkPath(pts, () => {
        avatar.faceTable(seat.x * this.tile);
        this.seatedCount++;
      });
    }
  };

  private onAddAgent = (agent: import('@evoluze/shared').Agent) => {
    if (this.agents.has(agent.id)) return;
    this.agents.set(agent.id, new AgentAvatar(this, agent));
  };

  private onBubble = (msg: { speakerId: string | null; content: string }) => {
    if (!msg.speakerId) return;
    this.agents.get(msg.speakerId)?.showBubble(msg.content);
  };

  private onThinking = (agentId: string) => {
    this.agents.get(agentId)?.showThinking();
  };

  private onReturn = () => {
    this.seatingMeetingId = null;
    for (const a of this.agents.values()) {
      a.hideBubble();
      a.returnHome();
    }
  };

  private playerInMeetingRoom(): boolean {
    if (!this.meetingRoomTiles) return true;
    const tx = Math.floor(this.player.container.x / this.tile);
    const ty = Math.floor(this.player.container.y / this.tile);
    const r = this.meetingRoomTiles;
    return tx >= r.x && tx < r.x + r.w && ty >= r.y && ty < r.y + r.h;
  }

  update(time: number) {
    const k = this.keys;
    this.player.update(time, {
      up: k.W.isDown || k.UP.isDown,
      down: k.S.isDown || k.DOWN.isDown,
      left: k.A.isDown || k.LEFT.isDown,
      right: k.D.isDown || k.RIGHT.isDown,
    }, this.locked);

    // Proximidade (só quando livre)
    if (!this.locked) {
      const radius = PROXIMITY_RADIUS_TILES * this.tile;
      let nearest: string | null = null;
      let best = radius;
      for (const [id, a] of this.agents) {
        const d = Phaser.Math.Distance.Between(this.player.container.x, this.player.container.y, a.x, a.y);
        if (d < best) {
          best = d;
          nearest = id;
        }
      }
      if (nearest !== this.nearbyId) {
        this.nearbyId = nearest;
        gameBus.emitT('proximity:change', nearest);
      }
    } else if (this.nearbyId) {
      this.nearbyId = null;
      gameBus.emitT('proximity:change', null);
    }

    // Todos sentados + CEO na sala → começa
    if (
      this.seatingMeetingId &&
      !this.notifiedSeated &&
      this.seatedCount >= this.seatTotal &&
      this.seatTotal > 0 &&
      this.playerInMeetingRoom()
    ) {
      this.notifiedSeated = true;
      gameBus.emitT('meeting:allSeated', this.seatingMeetingId);
    }
  }
}
