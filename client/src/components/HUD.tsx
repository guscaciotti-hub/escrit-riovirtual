import { useStore } from '../store/useStore';

export function HUD() {
  const boot = useStore((s) => s.boot)!;
  const connected = useStore((s) => s.connected);
  const nearbyId = useStore((s) => s.nearbyAgentId);
  const agentById = useStore((s) => s.agentById);
  const chatAgentId = useStore((s) => s.chatAgentId);
  const meetingPhase = useStore((s) => s.meetingPhase);
  const setMeetingModalOpen = useStore((s) => s.setMeetingModalOpen);
  const setAgentFormOpen = useStore((s) => s.setAgentFormOpen);

  const llm = boot.features.llmEnabled;
  const online = boot.online;
  const nearby = nearbyId ? agentById(nearbyId) : null;
  const canMeet = online && llm && meetingPhase !== 'running' && meetingPhase !== 'seating';

  return (
    <>
      {/* Barra superior */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-start justify-between p-3">
        <div className="pointer-events-auto flex items-center gap-3 rounded-xl border border-evoluze-border bg-evoluze-panel/90 px-4 py-2 backdrop-blur">
          <div className="text-sm font-bold text-evoluze-teal">🏢 Escritório Virtual</div>
          <span className="text-xs text-slate-400">{boot.org.name}</span>
          <StatusBadge online={online} connected={connected} llm={llm} />
        </div>

        <div className="pointer-events-auto flex items-center gap-2">
          <button
            onClick={() => setAgentFormOpen(true)}
            disabled={!online}
            className="rounded-lg border border-evoluze-border bg-evoluze-panel/90 px-3 py-2 text-xs font-medium text-slate-200 backdrop-blur transition hover:border-evoluze-teal/50 disabled:cursor-not-allowed disabled:opacity-40"
            title={online ? 'Criar novo agente (API)' : 'Requer backend online'}
          >
            + Novo agente
          </button>
          <button
            onClick={() => setMeetingModalOpen(true)}
            disabled={!canMeet}
            className="rounded-lg bg-evoluze-teal px-4 py-2 text-xs font-semibold text-evoluze-dark shadow-lg shadow-evoluze-teal/20 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
            title={
              !online
                ? 'Requer backend online'
                : !llm
                  ? 'Defina ANTHROPIC_API_KEY no servidor'
                  : 'Convocar reunião'
            }
          >
            📋 Convocar Reunião
          </button>
        </div>
      </div>

      {/* Prompt de proximidade */}
      {nearby && !chatAgentId && meetingPhase !== 'running' && (
        <div className="pointer-events-none absolute bottom-24 left-1/2 z-20 -translate-x-1/2 animate-fade-in-up">
          <div className="flex items-center gap-2 rounded-full border border-evoluze-border bg-evoluze-dark/95 px-5 py-2.5 shadow-xl">
            <kbd className="rounded bg-evoluze-teal px-2 py-0.5 text-xs font-bold text-evoluze-dark">E</kbd>
            <span className="text-sm text-slate-100">
              Falar com <b>{nearby.name}</b>
              <span className="ml-1 text-xs text-slate-400">· {nearby.jobTitle}</span>
            </span>
          </div>
        </div>
      )}

      {/* Dica de controles */}
      <div className="pointer-events-none absolute bottom-3 left-3 z-20 rounded-lg bg-evoluze-dark/70 px-3 py-1.5 text-[11px] text-slate-400">
        WASD / setas para andar · E para conversar
      </div>
    </>
  );
}

function StatusBadge({ online, connected, llm }: { online: boolean; connected: boolean; llm: boolean }) {
  if (!online) {
    return (
      <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-medium text-amber-300">
        ● preview offline
      </span>
    );
  }
  return (
    <span className="flex items-center gap-2">
      <span
        className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
          connected ? 'bg-emerald-500/15 text-emerald-300' : 'bg-slate-500/15 text-slate-400'
        }`}
      >
        ● {connected ? 'online' : 'conectando…'}
      </span>
      {!llm && (
        <span className="rounded-full bg-rose-500/15 px-2 py-0.5 text-[10px] font-medium text-rose-300">
          LLM off
        </span>
      )}
    </span>
  );
}
