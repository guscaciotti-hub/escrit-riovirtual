import { useEffect, useState } from 'react';
import type { User } from '@evoluze/shared';
import { createTeamMember, listTeam, setMemberActive } from '../lib/api';
import { useStore } from '../store/useStore';

const LOOK_COLORS = ['#3FA89E', '#D4704F', '#7B61C9', '#4E9A3F', '#E0A53C', '#4E86C9'];

/** Cadastro e gestão de colaboradores — só o gestor enxerga. */
export function TeamPanel() {
  const open = useStore((s) => s.teamOpen);
  const setOpen = useStore((s) => s.setTeamOpen);
  const me = useStore((s) => s.boot)!.user;

  const [team, setTeam] = useState<User[]>([]);
  const [form, setForm] = useState({ name: '', email: '', password: '', look: 1 });
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) listTeam().then(setTeam).catch(() => undefined);
  }, [open]);

  if (!open) return null;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    setOk(null);
    setBusy(true);
    try {
      const created = await createTeamMember(form);
      setTeam((t) => [...t, created]);
      setOk(`${created.name} cadastrado. Passe o e-mail e a senha para a pessoa.`);
      setForm({ name: '', email: '', password: '', look: (form.look + 1) % 6 });
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : 'Erro ao cadastrar');
    } finally {
      setBusy(false);
    }
  };

  const toggle = async (u: User, active: boolean) => {
    try {
      const updated = await setMemberActive(u.id, active);
      setTeam((t) => t.map((x) => (x.id === u.id ? updated : x)));
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : 'Erro');
    }
  };

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setOpen(false)}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[88vh] w-[560px] max-w-[95vw] flex-col rounded-2xl border border-[#4A3828] bg-[#241B14] shadow-2xl"
      >
        <header className="flex items-center justify-between border-b border-[#4A3828] p-5">
          <div>
            <div className="text-[11px] font-medium uppercase tracking-wide text-[#3FA89E]">Equipe</div>
            <h2 className="text-lg font-bold text-[#E8D5B0]">Quem tem acesso ao escritório</h2>
          </div>
          <button onClick={() => setOpen(false)} className="rounded p-1 text-[#9A8468] hover:text-[#E8D5B0]">✕</button>
        </header>

        <div className="thin-scroll flex-1 space-y-5 overflow-y-auto p-5">
          <form onSubmit={submit} className="rounded-xl border border-[#4A3828] bg-[#1A130E] p-4">
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-[#3FA89E]">
              Cadastrar colaborador
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Nome">
                <input className={inp} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
              </Field>
              <Field label="E-mail">
                <input type="email" className={inp} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
              </Field>
              <Field label="Senha provisória">
                <input className={inp} value={form.password} minLength={6} onChange={(e) => setForm({ ...form, password: e.target.value })} required />
              </Field>
              <Field label="Personagem">
                <div className="flex gap-1.5 pt-1">
                  {LOOK_COLORS.map((c, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setForm({ ...form, look: i })}
                      style={{ background: c }}
                      className={`h-7 w-7 rounded-md transition ${form.look === i ? 'ring-2 ring-[#E8D5B0] ring-offset-2 ring-offset-[#1A130E]' : 'opacity-60'}`}
                      aria-label={`Visual ${i + 1}`}
                    />
                  ))}
                </div>
              </Field>
            </div>
            {err && <div className="mt-3 rounded bg-[#4A1F1F] px-3 py-2 text-xs text-[#FFB4B4]">{err}</div>}
            {ok && <div className="mt-3 rounded bg-[#1F3A2A] px-3 py-2 text-xs text-[#9BE7B4]">{ok}</div>}
            <button
              type="submit"
              disabled={busy}
              className="mt-4 w-full rounded-lg bg-[#3FA89E] px-4 py-2 text-sm font-semibold text-[#10201E] disabled:opacity-50"
            >
              {busy ? 'Cadastrando…' : 'Cadastrar'}
            </button>
          </form>

          <div>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#3FA89E]">
              Pessoas ({team.length})
            </h3>
            <ul className="space-y-1.5">
              {team.map((u) => (
                <li
                  key={u.id}
                  className="flex items-center gap-3 rounded-lg border border-[#4A3828] bg-[#1A130E] px-3 py-2"
                >
                  <span className="h-6 w-6 rounded-md" style={{ background: LOOK_COLORS[u.look] ?? '#888' }} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm text-[#E8D5B0]">
                      {u.name}
                      {u.id === me.id && <span className="ml-2 text-[10px] text-[#7A6650]">você</span>}
                      {u.role === 'master' && <span className="ml-2 text-[10px] text-[#3FA89E]">gestor</span>}
                    </div>
                    <div className="truncate text-[11px] text-[#7A6650]">{u.email}</div>
                  </div>
                  {u.id !== me.id && (
                    <button
                      onClick={() => toggle(u, false)}
                      className="rounded border border-[#4A3828] px-2 py-1 text-[10px] text-[#9A8468] hover:text-[#FFB4B4]"
                    >
                      Desativar
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

const inp =
  'w-full rounded-lg border border-[#4A3828] bg-[#241B14] px-3 py-2 text-sm text-[#E8D5B0] outline-none focus:border-[#3FA89E]';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-[#C4AD8C]">{label}</span>
      {children}
    </label>
  );
}
