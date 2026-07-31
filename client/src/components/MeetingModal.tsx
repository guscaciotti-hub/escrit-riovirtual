import { useEffect, useState } from 'react';
import type { MeetingMode } from '@evoluze/shared';
import { useStore } from '../store/useStore';
import { estimateMeeting } from '../lib/api';
import { convene } from '../hooks/useRealtime';

const MODES: Array<{ id: MeetingMode; label: string; hint: string }> = [
  { id: 'debate', label: 'Debate', hint: 'discordam mais, confronto saudável' },
  { id: 'brainstorm', label: 'Brainstorm', hint: 'divergente, sem crítica' },
  { id: 'decisao', label: 'Decisão', hint: 'converge rápido' },
];
const ROUND_OPTIONS = [3, 5, 8, 10, 15];

export function MeetingModal() {
  const open = useStore((s) => s.meetingModalOpen);
  const setOpen = useStore((s) => s.setMeetingModalOpen);
  const boot = useStore((s) => s.boot)!;
  const setEstimate = useStore((s) => s.setEstimate);
  const estimate = useStore((s) => s.estimate);

  const [title, setTitle] = useState('');
  const [agenda, setAgenda] = useState('');
  const [mode, setMode] = useState<MeetingMode>('debate');
  const [rounds, setRounds] = useState(5);
  const [maxTokens, setMaxTokens] = useState(60000);
  const [selected, setSelected] = useState<string[]>(boot.agents.map((a) => a.id));
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!open || selected.length === 0) return;
    estimateMeeting(rounds, selected.length).then(setEstimate).catch(() => setEstimate(null));
  }, [open, rounds, selected.length, setEstimate]);

  if (!open) return null;

  const toggle = (id: string) =>
    setSelected((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));

  const submit = async () => {
    setErr(null);
    if (!title.trim() || !agenda.trim()) return setErr('Título e pauta são obrigatórios.');
    if (selected.length === 0) return setErr('Selecione ao menos um agente.');
    setSubmitting(true);
    const res = await convene({
      title: title.trim(),
      agenda: agenda.trim(),
      mode,
      agentIds: selected,
      maxRounds: rounds,
      maxTokens,
    });
    setSubmitting(false);
    if (res.error) return setErr(res.error);
    setOpen(false);
  };

  return (
    <Overlay onClose={() => setOpen(false)}>
      <div className="w-[560px] max-w-[92vw] rounded-2xl border border-evoluze-border bg-evoluze-panel p-6 shadow-2xl">
        <h2 className="mb-1 text-lg font-bold">📋 Convocar Reunião</h2>
        <p className="mb-4 text-xs text-slate-400">
          Os agentes vão caminhar até a sala. A reunião começa quando você também estiver lá.
        </p>

        <label className="mb-1 block text-xs font-medium text-slate-300">Título *</label>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Ex.: Pricing do novo SaaS para clínicas"
          className="mb-3 w-full rounded-lg border border-evoluze-border bg-evoluze-dark px-3 py-2 text-sm outline-none focus:border-evoluze-teal"
        />

        <label className="mb-1 block text-xs font-medium text-slate-300">Pauta *</label>
        <textarea
          value={agenda}
          onChange={(e) => setAgenda(e.target.value)}
          rows={3}
          placeholder="O que precisa ser decidido? Dê contexto para o debate."
          className="mb-3 w-full resize-none rounded-lg border border-evoluze-border bg-evoluze-dark px-3 py-2 text-sm outline-none focus:border-evoluze-teal"
        />

        <label className="mb-1 block text-xs font-medium text-slate-300">Participantes</label>
        <div className="mb-3 flex flex-wrap gap-2">
          {boot.agents.map((a) => {
            const on = selected.includes(a.id);
            return (
              <button
                key={a.id}
                onClick={() => toggle(a.id)}
                className={`rounded-lg border px-3 py-1.5 text-xs transition ${
                  on ? 'border-evoluze-teal bg-evoluze-teal/15 text-evoluze-teal' : 'border-evoluze-border text-slate-300'
                }`}
              >
                {a.name.split(' ')[0]} · {a.department}
              </button>
            );
          })}
        </div>

        <div className="mb-3 grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-300">Duração (rounds)</label>
            <select
              value={rounds}
              onChange={(e) => setRounds(Number(e.target.value))}
              className="w-full rounded-lg border border-evoluze-border bg-evoluze-dark px-3 py-2 text-sm outline-none focus:border-evoluze-teal"
            >
              {ROUND_OPTIONS.map((r) => (
                <option key={r} value={r}>{r} rounds</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-300">Limite de tokens</label>
            <select
              value={maxTokens}
              onChange={(e) => setMaxTokens(Number(e.target.value))}
              className="w-full rounded-lg border border-evoluze-border bg-evoluze-dark px-3 py-2 text-sm outline-none focus:border-evoluze-teal"
            >
              {[30000, 60000, 100000, 150000].map((t) => (
                <option key={t} value={t}>{(t / 1000).toFixed(0)}k tokens</option>
              ))}
            </select>
          </div>
        </div>

        <label className="mb-1 block text-xs font-medium text-slate-300">Modo</label>
        <div className="mb-4 grid grid-cols-3 gap-2">
          {MODES.map((m) => (
            <button
              key={m.id}
              onClick={() => setMode(m.id)}
              className={`rounded-lg border px-3 py-2 text-left text-xs transition ${
                mode === m.id ? 'border-evoluze-teal bg-evoluze-teal/10' : 'border-evoluze-border'
              }`}
            >
              <div className="font-semibold">{m.label}</div>
              <div className="text-[10px] text-slate-400">{m.hint}</div>
            </button>
          ))}
        </div>

        {/* Estimativa de custo ANTES de confirmar */}
        <div className="mb-4 rounded-lg border border-evoluze-border bg-evoluze-dark/60 p-3 text-xs">
          <div className="mb-1 font-medium text-slate-300">Estimativa (antes de rodar)</div>
          {estimate ? (
            <div className="flex flex-wrap gap-x-5 gap-y-1 text-slate-400">
              <span>~{estimate.estimatedTurns} falas</span>
              <span>~{(estimate.estimatedTokens / 1000).toFixed(1)}k tokens</span>
              <span className="text-evoluze-teal">~US$ {estimate.estimatedCostUsd.toFixed(3)}</span>
            </div>
          ) : (
            <span className="text-slate-500">selecione participantes…</span>
          )}
        </div>

        {err && <div className="mb-3 text-xs text-rose-400">{err}</div>}

        <div className="flex justify-end gap-2">
          <button onClick={() => setOpen(false)} className="rounded-lg px-4 py-2 text-sm text-slate-400 hover:text-white">
            Cancelar
          </button>
          <button
            onClick={submit}
            disabled={submitting}
            className="rounded-lg bg-evoluze-teal px-5 py-2 text-sm font-semibold text-evoluze-dark disabled:opacity-50"
          >
            {submitting ? 'Convocando…' : 'Convocar e sentar'}
          </button>
        </div>
      </div>
    </Overlay>
  );
}

function Overlay({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()}>{children}</div>
    </div>
  );
}
