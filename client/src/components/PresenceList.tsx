import { useStore } from '../store/useStore';

/** Lista de presença lateral (estilo Gather): CEO + agentes. */
export function PresenceList() {
  const boot = useStore((s) => s.boot)!;
  const nearbyId = useStore((s) => s.nearbyAgentId);
  const thinkingId = useStore((s) => s.thinkingAgentId);
  const phase = useStore((s) => s.meetingPhase);

  return (
    <div className="pointer-events-none absolute right-3 top-16 z-20 w-52">
      <div className="pointer-events-auto rounded-xl border border-evoluze-border bg-evoluze-panel/85 p-3 backdrop-blur">
        <div className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
          No escritório · {boot.agents.length + 1}
        </div>
        <ul className="space-y-1.5">
          <li className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-emerald-400" />
            <span className="text-sm font-medium text-evoluze-teal">{boot.user.name.split(' ')[0]}</span>
            <span className="ml-auto text-[10px] text-slate-500">você · CEO</span>
          </li>
          {boot.agents.map((a) => {
            const active = phase === 'running' && thinkingId === a.id;
            return (
              <li key={a.id} className="flex items-center gap-2">
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ background: active ? '#facc15' : (a.avatarConfig.tint ?? '#64748b') }}
                />
                <span className={`text-sm ${nearbyId === a.id ? 'text-white' : 'text-slate-300'}`}>
                  {a.name.split(' ')[0]}
                </span>
                <span className="ml-auto truncate text-[10px] text-slate-500">{a.department}</span>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
