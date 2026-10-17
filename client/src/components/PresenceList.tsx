import { useStore } from '../store/useStore';

const LOOK_COLORS = ['#3FA89E', '#D4704F', '#7B61C9', '#4E9A3F', '#E0A53C', '#4E86C9'];

/** Quem está no escritório neste momento. */
export function PresenceList() {
  const boot = useStore((s) => s.boot)!;
  const presence = useStore((s) => s.presence);
  const connected = useStore((s) => s.connected);

  const others = presence.filter((p) => p.id !== boot.user.id);

  return (
    <div className="pointer-events-none absolute right-3 top-16 z-20 w-52">
      <div className="pointer-events-auto rounded-xl border border-[#4A3828] bg-[#241B14]/90 p-3 backdrop-blur">
        <div className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-[#9A8468]">
          No escritório · {others.length + 1}
        </div>
        <ul className="space-y-1.5">
          <li className="flex items-center gap-2">
            <span
              className="h-2.5 w-2.5 rounded-full"
              style={{ background: LOOK_COLORS[boot.user.look] ?? '#3FA89E' }}
            />
            <span className="text-sm font-medium text-[#3FA89E]">{boot.user.name.split(' ')[0]}</span>
            <span className="ml-auto text-[10px] text-[#7A6650]">você</span>
          </li>
          {others.map((p) => (
            <li key={p.id} className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: LOOK_COLORS[p.look] ?? '#888' }} />
              <span className="text-sm text-[#E8D5B0]">{p.name.split(' ')[0]}</span>
            </li>
          ))}
          {others.length === 0 && (
            <li className="pt-1 text-[11px] text-[#7A6650]">
              {connected ? 'Ninguém mais por aqui agora.' : 'Conectando…'}
            </li>
          )}
        </ul>
      </div>
    </div>
  );
}
