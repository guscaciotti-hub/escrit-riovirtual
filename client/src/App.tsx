import { useEffect, useState } from 'react';
import { fetchBootstrap } from './lib/api';
import { useStore } from './store/useStore';
import { useRealtime } from './hooks/useRealtime';
import { GameCanvas } from './components/GameCanvas';
import { HUD } from './components/HUD';
import { ChatPanel } from './components/ChatPanel';
import { MeetingModal } from './components/MeetingModal';
import { TranscriptPanel } from './components/TranscriptPanel';
import { MinutesViewer } from './components/MinutesViewer';
import { PresenceList } from './components/PresenceList';
import { Minimap } from './components/Minimap';
import { AgentForm } from './components/AgentForm';

export default function App() {
  const boot = useStore((s) => s.boot);
  const setBoot = useStore((s) => s.setBoot);
  const [error, setError] = useState<string | null>(null);
  useRealtime();

  useEffect(() => {
    fetchBootstrap()
      .then(setBoot)
      .catch((e) => setError(e instanceof Error ? e.message : 'Falha ao carregar'));
  }, [setBoot]);

  if (error) {
    return (
      <div className="flex h-full items-center justify-center p-8 text-center">
        <div>
          <p className="text-lg font-semibold text-red-400">Erro ao iniciar</p>
          <p className="mt-2 text-sm text-slate-400">{error}</p>
        </div>
      </div>
    );
  }

  if (!boot) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="animate-pulse text-center">
          <div className="text-2xl font-bold text-evoluze-teal">Evoluze</div>
          <div className="mt-2 text-sm text-slate-400">Carregando escritório…</div>
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
      <ChatPanel />
      <MeetingModal />
      <TranscriptPanel />
      <MinutesViewer />
      <AgentForm />
    </div>
  );
}
