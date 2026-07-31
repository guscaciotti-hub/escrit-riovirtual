import { useEffect, useState } from 'react';
import { MAP_HEIGHT_TILES, MAP_WIDTH_TILES, ROOMS, TILE_SIZE } from '@evoluze/shared';
import { useStore } from '../store/useStore';
import { gameBus } from '../lib/gameBus';

const SCALE = 4; // px do minimapa por tile
const ROOM_COLORS: Record<string, string> = {
  open_space: '#1c2c49',
  meeting: '#123030',
  lounge: '#1a2b26',
  private: '#241a2e',
};

/** Minimapa no canto (estilo Gather). */
export function Minimap() {
  const boot = useStore((s) => s.boot)!;
  const [player, setPlayer] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const onMove = (p: { x: number; y: number }) => setPlayer({ x: p.x, y: p.y });
    gameBus.onT('player:move', onMove);
    return () => {
      gameBus.offT('player:move', onMove);
    };
  }, []);

  const w = MAP_WIDTH_TILES * SCALE;
  const h = MAP_HEIGHT_TILES * SCALE;
  const toMap = (px: number) => (px / TILE_SIZE) * SCALE;

  return (
    <div className="pointer-events-none absolute bottom-3 right-3 z-20 rounded-lg border border-evoluze-border bg-evoluze-dark/80 p-1.5 backdrop-blur">
      <svg width={w} height={h} className="block rounded">
        <rect x={0} y={0} width={w} height={h} fill="#0b1220" />
        {ROOMS.map((r) => (
          <rect
            key={r.id}
            x={r.bounds.x * SCALE}
            y={r.bounds.y * SCALE}
            width={r.bounds.w * SCALE}
            height={r.bounds.h * SCALE}
            fill={ROOM_COLORS[r.type] ?? '#1c2c49'}
            stroke="#2b3d63"
            strokeWidth={0.5}
          />
        ))}
        {boot.agents.map((a) => (
          <circle
            key={a.id}
            cx={toMap(a.spawnX)}
            cy={toMap(a.spawnY)}
            r={2}
            fill={a.avatarConfig.tint ?? '#64748b'}
          />
        ))}
        <circle cx={toMap(player.x)} cy={toMap(player.y)} r={2.5} fill="#00D4C6" stroke="#fff" strokeWidth={0.6} />
      </svg>
    </div>
  );
}
