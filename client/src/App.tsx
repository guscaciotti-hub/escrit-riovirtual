import { useCallback, useEffect, useState } from 'react';
import { ApiError, fetchBootstrap, setToken } from './lib/api';
import { useStore } from './store/useStore';
import { useRealtime } from './hooks/useRealtime';
import { GameCanvas } from './components/GameCanvas';
import { HUD } from './components/HUD';
import { PresenceList } from './components/PresenceList';
import { Minimap } from './components/Minimap';
import { LoginScreen } from './components/LoginScreen';
import { TeamPanel } from './components/TeamPanel';
import { ProductivityPanel } from './components/ProductivityPanel';
import { ConsentModal } from './components/ConsentModal';

type Phase = 'checking' | 'login' | 'ready' | 'error';

export default function App() {
  const boot = useStore((s) => s.boot);
  const setBoot = useStore((s) => s.setBoot);
  const [phase, setPhase] = useState<Phase>('checking');
  const [error, setError] = useState<string | null>(null);
  useRealtime();

  const load = useCallback(() => {
    setPhase('checking');
    fetchBootstrap()
      .then((b) => {
        setBoot(b);
        setPhase('ready');
      })
      .catch((e) => {
        if (e instanceof ApiError && e.status === 401) {
          setToken(null);
          setPhase('login');
          return;
        }
        setError(e instanceof Error ? e.message : 'Falha ao carregar');
        setPhase('error');
      });
  }, [setBoot]);

  useEffect(() => {
    // Sempre tenta carregar: se o servidor responder 401 vai para o login;
    // se não houver servidor algum, o bootstrap cai em modo demonstração
    // (mapa explorável, sem login e sem dados reais).
    load();
  }, [load]);

  if (phase === 'login') return <LoginScreen onDone={load} />;

  if (phase === 'error') {
    return (
      <div className="flex h-full items-center justify-center bg-[#1a1410] p-8 text-center">
        <div>
          <p className="text-lg font-semibold text-[#FFB4B4]">Erro ao iniciar</p>
          <p className="mt-2 text-sm text-[#9A8468]">{error}</p>
        </div>
      </div>
    );
  }

  if (phase === 'checking' || !boot) {
    return (
      <div className="flex h-full items-center justify-center bg-[#1a1410]">
        <div className="animate-pulse text-center">
          <div className="text-2xl font-bold text-[#3FA89E]">Evoluze</div>
          <div className="mt-2 text-sm text-[#9A8468]">Abrindo o escritório…</div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-full w-full overflow-hidden">
      <GameCanvas />
      <HUD />
      <PresenceList />
      <Minimap />
      <TeamPanel />
      <ProductivityPanel />
      <ConsentModal />
    </div>
  );
}
