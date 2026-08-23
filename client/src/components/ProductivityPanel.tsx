import { useEffect, useMemo, useState } from 'react';
import { WEB_CATEGORIES, type ActivitySummary, type WebCategory } from '@evoluze/shared';
import {
  createExtensionToken,
  getPeople,
  getSummary,
  myDataExportUrl,
  type PersonRow,
} from '../lib/api';
import { useStore } from '../store/useStore';

const RANGES = [
  { days: 7, label: '7 dias' },
  { days: 14, label: '14 dias' },
  { days: 30, label: '30 dias' },
];

const isoDaysAgo = (n: number) => new Date(Date.now() - n * 86400_000).toISOString().slice(0, 10);
const fmtHours = (sec: number) => {
  const h = Math.floor(sec / 3600);
  const m = Math.round((sec % 3600) / 60);
  return h > 0 ? `${h}h${m > 0 ? ` ${m}min` : ''}` : `${m}min`;
};

/** Painel de produtividade — acesso restrito ao gestor (role master). */
export function ProductivityPanel() {
  const open = useStore((s) => s.productivityOpen);
  const setOpen = useStore((s) => s.setProductivityOpen);
  const boot = useStore((s) => s.boot)!;

  const [days, setDays] = useState(7);
  const [data, setData] = useState<ActivitySummary | null>(null);
  const [people, setPeople] = useState<PersonRow[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [pairing, setPairing] = useState<{ token: string; serverUrl: string } | null>(null);

  useEffect(() => {
    if (!open) return;
    setErr(null);
    const to = isoDaysAgo(0);
    const from = isoDaysAgo(days - 1);
    Promise.all([getSummary(from, to), getPeople()])
      .then(([s, p]) => {
        setData(s);
        setPeople(p);
      })
      .catch((e) => setErr(e instanceof Error ? e.message : 'Erro ao carregar'));
  }, [open, days]);

  /** Agrupa os dias por pessoa. */
  const byPerson = useMemo(() => {
    const map = new Map<
      string,
      { name: string; office: number; focus: number; meeting: number; idle: number; web: Record<string, number> }
    >();
    for (const d of data?.days ?? []) {
      const cur =
        map.get(d.userId) ?? { name: d.userName, office: 0, focus: 0, meeting: 0, idle: 0, web: {} };
      cur.office += d.secondsOffice;
      cur.focus += d.secondsFocus;
      cur.meeting += d.secondsMeeting;
      cur.idle += d.secondsIdle;
      for (const [k, v] of Object.entries(d.webCategories)) cur.web[k] = (cur.web[k] ?? 0) + (v ?? 0);
      map.set(d.userId, cur);
    }
    return [...map.entries()].sort((a, b) => b[1].office - a[1].office);
  }, [data]);

  if (!open) return null;

  const pair = async () => {
    try {
      setPairing(await createExtensionToken('Navegador'));
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Erro');
    }
  };

  const t = data?.totals;

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setOpen(false)}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[90vh] w-[860px] max-w-[96vw] flex-col rounded-2xl border border-evoluze-border bg-evoluze-panel shadow-2xl"
      >
        <header className="flex items-center justify-between border-b border-evoluze-border p-5">
          <div>
            <div className="text-[11px] font-medium uppercase tracking-wide text-evoluze-teal">
              Painel do gestor
            </div>
            <h2 className="text-lg font-bold">Produtividade</h2>
          </div>
          <div className="flex items-center gap-2">
            {RANGES.map((r) => (
              <button
                key={r.days}
                onClick={() => setDays(r.days)}
                className={`rounded-lg px-3 py-1.5 text-xs transition ${
                  days === r.days
                    ? 'bg-evoluze-teal text-evoluze-dark font-semibold'
                    : 'border border-evoluze-border text-slate-300'
                }`}
              >
                {r.label}
              </button>
            ))}
            <button onClick={() => setOpen(false)} className="ml-1 rounded p-1 text-slate-400 hover:text-white">✕</button>
          </div>
        </header>

        <div className="thin-scroll flex-1 space-y-5 overflow-y-auto p-5">
          {err && <div className="rounded-lg bg-rose-500/10 p-3 text-xs text-rose-300">{err}</div>}

          {t && (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Stat label="No escritório" value={fmtHours(t.secondsOffice)} tint="#00D4C6" />
              <Stat label="Foco" value={fmtHours(t.secondsFocus)} tint="#3DDC97" />
              <Stat label="Reuniões" value={fmtHours(t.secondsMeeting)} tint="#7B61FF" />
              <Stat label="Ocioso" value={fmtHours(t.secondsIdle)} tint="#9AA5B8" />
            </div>
          )}

          {byPerson.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-500">
              Nenhum dado no período. O registro começa quando a pessoa aceita o aviso e entra no escritório.
            </p>
          ) : (
            byPerson.map(([id, p]) => {
              const webTotal = Object.values(p.web).reduce((a, b) => a + b, 0);
              return (
                <div key={id} className="rounded-xl border border-evoluze-border bg-evoluze-dark/40 p-4">
                  <div className="mb-3 flex items-baseline justify-between">
                    <span className="font-semibold text-slate-100">{p.name}</span>
                    <span className="text-xs tabular-nums text-slate-400">
                      {fmtHours(p.office)} no escritório
                    </span>
                  </div>

                  <StackedBar
                    segments={[
                      { label: 'Foco', value: p.focus, color: '#3DDC97' },
                      { label: 'Reunião', value: p.meeting, color: '#7B61FF' },
                      { label: 'Ocioso', value: p.idle, color: '#3a445a' },
                    ]}
                  />

                  {webTotal > 0 && (
                    <div className="mt-4">
                      <div className="mb-2 text-[11px] font-medium uppercase tracking-wide text-slate-500">
                        Tempo por categoria de site
                      </div>
                      <div className="space-y-1.5">
                        {Object.entries(p.web)
                          .sort((a, b) => b[1] - a[1])
                          .map(([cat, sec]) => {
                            const meta = WEB_CATEGORIES.find((c) => c.id === (cat as WebCategory));
                            const pct = Math.round((sec / webTotal) * 100);
                            return (
                              <div key={cat}>
                                <div className="flex justify-between text-xs">
                                  <span className="text-slate-300">
                                    {meta?.label ?? cat}
                                    {meta && !meta.productive && (
                                      <span className="ml-1.5 text-[10px] text-slate-500">não-produtivo</span>
                                    )}
                                  </span>
                                  <span className="tabular-nums text-slate-400">{fmtHours(sec)}</span>
                                </div>
                                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-evoluze-panel">
                                  <div
                                    className="h-full rounded-full"
                                    style={{ width: `${pct}%`, background: meta?.color ?? '#5C6784' }}
                                  />
                                </div>
                              </div>
                            );
                          })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}

          {/* Estado de consentimento por pessoa */}
          <div className="rounded-xl border border-evoluze-border p-4">
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-evoluze-teal">
              Pessoas e consentimento
            </h3>
            <ul className="space-y-2">
              {people.map((p) => (
                <li key={p.id} className="flex items-center justify-between text-sm">
                  <span className="text-slate-200">
                    {p.name}
                    {p.role === 'master' && <span className="ml-2 text-[10px] text-slate-500">gestor</span>}
                  </span>
                  <span className="flex gap-1.5">
                    {p.consents.map((c) => (
                      <span
                        key={c.scope}
                        className={`rounded-full px-2 py-0.5 text-[10px] ${
                          c.current
                            ? 'bg-emerald-500/15 text-emerald-300'
                            : 'bg-slate-500/15 text-slate-400'
                        }`}
                      >
                        {c.scope === 'office' ? 'escritório' : 'extensão'} {c.current ? 'ativo' : 'inativo'}
                      </span>
                    ))}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          {/* Pareamento da extensão */}
          <div className="rounded-xl border border-evoluze-border p-4">
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-evoluze-teal">
              Extensão de navegador
            </h3>
            <p className="mb-3 text-xs text-slate-400">
              Gere um código e cole no popup da extensão. Ele aparece uma única vez — o servidor
              guarda apenas o hash.
            </p>
            {pairing ? (
              <div className="rounded-lg border border-evoluze-teal/40 bg-evoluze-teal/5 p-3">
                <code className="block break-all text-xs text-evoluze-teal">{pairing.token}</code>
                <p className="mt-2 text-[10px] text-slate-400">Servidor: {pairing.serverUrl}</p>
              </div>
            ) : (
              <button onClick={pair} className="rounded-lg border border-evoluze-border px-4 py-2 text-xs text-slate-200 hover:border-evoluze-teal/50">
                Gerar código de pareamento
              </button>
            )}
          </div>

          <div className="flex flex-wrap gap-2 border-t border-evoluze-border pt-4">
            <a
              href={myDataExportUrl()}
              className="rounded-lg border border-evoluze-border px-3 py-1.5 text-xs text-slate-300 hover:text-white"
            >
              ⬇ Exportar meus dados (LGPD)
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, tint }: { label: string; value: string; tint: string }) {
  return (
    <div className="rounded-xl border border-evoluze-border bg-evoluze-dark/40 p-3">
      <div className="text-[10px] uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-1 text-lg font-bold tabular-nums" style={{ color: tint }}>
        {value}
      </div>
    </div>
  );
}

function StackedBar({ segments }: { segments: Array<{ label: string; value: number; color: string }> }) {
  const total = segments.reduce((a, s) => a + s.value, 0) || 1;
  return (
    <>
      <div className="flex h-2.5 overflow-hidden rounded-full bg-evoluze-panel">
        {segments.map((s) => (
          <div key={s.label} style={{ width: `${(s.value / total) * 100}%`, background: s.color }} />
        ))}
      </div>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
        {segments.map((s) => (
          <span key={s.label} className="flex items-center gap-1.5 text-[11px] text-slate-400">
            <i className="inline-block h-2 w-2 rounded-full" style={{ background: s.color }} />
            {s.label} <span className="tabular-nums text-slate-300">{fmtHours(s.value)}</span>
          </span>
        ))}
      </div>
    </>
  );
}
