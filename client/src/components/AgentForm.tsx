import { useState } from 'react';
import type { AgentModel } from '@evoluze/shared';
import { TILE_SIZE } from '@evoluze/shared';
import { useStore } from '../store/useStore';
import { createAgent } from '../lib/api';
import { gameBus } from '../lib/gameBus';

/** Fase 4 — CRUD de agente pela UI. Backend completo; form simples. */
export function AgentForm() {
  const open = useStore((s) => s.agentFormOpen);
  const setOpen = useStore((s) => s.setAgentFormOpen);
  const addAgent = useStore((s) => s.addAgent);

  const [name, setName] = useState('');
  const [jobTitle, setJobTitle] = useState('');
  const [department, setDepartment] = useState('');
  const [tint, setTint] = useState('#f59e0b');
  const [model, setModel] = useState<AgentModel>('claude-haiku-4-5');
  const [tileX, setTileX] = useState(9);
  const [tileY, setTileY] = useState(11);
  const [scope, setScope] = useState('');
  const [persona, setPersona] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  if (!open) return null;

  const submit = async () => {
    setErr(null);
    if (!name.trim() || !jobTitle.trim() || !department.trim() || !persona.trim() || !scope.trim()) {
      return setErr('Preencha nome, cargo, departamento, escopo e persona.');
    }
    setBusy(true);
    try {
      const agent = await createAgent({
        name: name.trim(),
        jobTitle: jobTitle.trim(),
        department: department.trim(),
        avatarConfig: { sprite: 'custom', tint },
        spawnX: tileX * TILE_SIZE + TILE_SIZE / 2,
        spawnY: tileY * TILE_SIZE + TILE_SIZE / 2,
        deskId: null,
        personaSystemPrompt: persona.trim(),
        knowledgeScope: scope.trim(),
        model,
      });
      addAgent(agent);
      gameBus.emitT('agent:add', agent);
      setOpen(false);
      setName('');
      setJobTitle('');
      setDepartment('');
      setPersona('');
      setScope('');
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Erro ao criar agente');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setOpen(false)}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="max-h-[88vh] w-[560px] max-w-[94vw] overflow-y-auto rounded-2xl border border-evoluze-border bg-evoluze-panel p-6 shadow-2xl thin-scroll"
      >
        <h2 className="mb-4 text-lg font-bold">+ Novo agente</h2>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Nome"><input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} /></Field>
          <Field label="Cargo"><input className={inputCls} value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} /></Field>
          <Field label="Departamento"><input className={inputCls} value={department} onChange={(e) => setDepartment(e.target.value)} /></Field>
          <Field label="Modelo">
            <select className={inputCls} value={model} onChange={(e) => setModel(e.target.value as AgentModel)}>
              <option value="claude-haiku-4-5">claude-haiku-4-5</option>
              <option value="claude-sonnet-4-6">claude-sonnet-4-6</option>
            </select>
          </Field>
          <Field label="Mesa — tile X"><input type="number" className={inputCls} value={tileX} onChange={(e) => setTileX(Number(e.target.value))} /></Field>
          <Field label="Mesa — tile Y"><input type="number" className={inputCls} value={tileY} onChange={(e) => setTileY(Number(e.target.value))} /></Field>
          <Field label="Cor">
            <input type="color" className="h-9 w-full rounded-lg border border-evoluze-border bg-evoluze-dark" value={tint} onChange={(e) => setTint(e.target.value)} />
          </Field>
        </div>
        <Field label="Escopo de conhecimento">
          <textarea rows={2} className={inputCls} value={scope} onChange={(e) => setScope(e.target.value)} />
        </Field>
        <Field label="Persona (system prompt)">
          <textarea rows={4} className={inputCls} value={persona} onChange={(e) => setPersona(e.target.value)} placeholder="Você é... Como pensa... Como fala... Em reunião..." />
        </Field>
        {err && <div className="mt-2 text-xs text-rose-400">{err}</div>}
        <div className="mt-4 flex justify-end gap-2">
          <button onClick={() => setOpen(false)} className="rounded-lg px-4 py-2 text-sm text-slate-400 hover:text-white">Cancelar</button>
          <button onClick={submit} disabled={busy} className="rounded-lg bg-evoluze-teal px-5 py-2 text-sm font-semibold text-evoluze-dark disabled:opacity-50">
            {busy ? 'Criando…' : 'Criar agente'}
          </button>
        </div>
      </div>
    </div>
  );
}

const inputCls =
  'w-full rounded-lg border border-evoluze-border bg-evoluze-dark px-3 py-2 text-sm outline-none focus:border-evoluze-teal';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="mb-2 block">
      <span className="mb-1 block text-xs font-medium text-slate-300">{label}</span>
      {children}
    </label>
  );
}
