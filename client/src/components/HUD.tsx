import { useEffect } from 'react';
import { useStore } from '../store/useStore';
import { getPause, setPause, setToken } from '../lib/api';

export function HUD() {
  const boot = useStore((s) => s.boot)!;
  const connected = useStore((s) => s.connected);
  const setTeamOpen = useStore((s) => s.setTeamOpen);
  const setProductivityOpen = useStore((s) => s.setProductivityOpen);
  const trackingPaused = useStore((s) => s.trackingPaused);
  const setTrackingPaused = useStore((s) => s.setTrackingPaused);

  const isMaster = boot.user.role === 'master';
  const online = boot.online;

  useEffect(() => {
    if (!online) return;
    getPause().then((r) => setTrackingPaused(r.paused)).catch(() => undefined);
  }, [online, setTrackingPaused]);

  const togglePause = async () => {
    const next = !trackingPaused;
    setTrackingPaused(next);
    try {
      await setPause(next);
    } catch {
      setTrackingPaused(!next);
    }
  };

  const logout = () => {
    setToken(null);
    window.location.reload();
  };

  return (
    <>
      <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-start justify-between p-3">
        <div className="pointer-events-auto flex items-center gap-3 rounded-xl border border-[#4A3828] bg-[#241B14]/90 px-4 py-2 backdrop-blur">
          <span className="text-sm font-bold text-[#3FA89E]">🏢 {boot.org.name}</span>
          <span
            className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
              !online
                ? 'bg-amber-500/15 text-amber-300'
                : connected
                  ? 'bg-emerald-500/15 text-emerald-300'
                  : 'bg-slate-500/15 text-slate-400'
            }`}
          >
            ● {!online ? 'preview offline' : connected ? 'online' : 'conectando…'}
          </span>
        </div>

        <div className="pointer-events-auto flex items-center gap-2">
          {online && (
            <button
              onClick={togglePause}
              className={`rounded-lg border px-3 py-2 text-xs font-medium backdrop-blur transition ${
                trackingPaused
                  ? 'border-amber-500/40 bg-amber-500/10 text-amber-300'
                  : 'border-[#4A3828] bg-[#241B14]/90 text-[#C4AD8C] hover:border-[#3FA89E]/50'
              }`}
              title={trackingPaused ? 'Retomar registro de atividade' : 'Pausar registro de atividade'}
            >
              {trackingPaused ? '⏸ registro pausado' : '● registrando'}
            </button>
          )}
          {online && isMaster && (
            <>
              <button
                onClick={() => setTeamOpen(true)}
                className="rounded-lg border border-[#4A3828] bg-[#241B14]/90 px-3 py-2 text-xs font-medium text-[#E8D5B0] backdrop-blur transition hover:border-[#3FA89E]/50"
              >
                👥 Equipe
              </button>
              <button
                onClick={() => setProductivityOpen(true)}
                className="rounded-lg border border-[#4A3828] bg-[#241B14]/90 px-3 py-2 text-xs font-medium text-[#E8D5B0] backdrop-blur transition hover:border-[#3FA89E]/50"
              >
                📊 Produtividade
              </button>
            </>
          )}
          <button
            onClick={logout}
            className="rounded-lg border border-[#4A3828] bg-[#241B14]/90 px-3 py-2 text-xs text-[#9A8468] backdrop-blur transition hover:text-[#E8D5B0]"
            title="Sair"
          >
            Sair
          </button>
        </div>
      </div>

      <div className="pointer-events-none absolute bottom-3 left-3 z-20 rounded-lg bg-[#241B14]/80 px-3 py-1.5 text-[11px] text-[#9A8468]">
        WASD ou setas para andar
      </div>
    </>
  );
}
