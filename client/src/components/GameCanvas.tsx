import { useEffect, useRef } from 'react';
import type Phaser from 'phaser';
import { createGame } from '../game/PhaserGame';
import { useStore } from '../store/useStore';

/** Container React que hospeda o canvas Phaser. */
export function GameCanvas() {
  const boot = useStore((s) => s.boot);
  const ref = useRef<HTMLDivElement>(null);
  const gameRef = useRef<Phaser.Game | null>(null);

  useEffect(() => {
    if (!boot || !ref.current || gameRef.current) return;
    gameRef.current = createGame(ref.current, boot);
    return () => {
      gameRef.current?.destroy(true);
      gameRef.current = null;
    };
  }, [boot]);

  return <div ref={ref} className="absolute inset-0" />;
}
