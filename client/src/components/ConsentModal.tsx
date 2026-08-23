import { useEffect, useState } from 'react';
import { acceptConsent, getConsents, getPolicy, type ActivityPolicy } from '../lib/api';
import { useStore } from '../store/useStore';

/**
 * Aviso de monitoramento exibido no primeiro acesso.
 * É a prova registrada (com data e versão) de que a pessoa foi informada —
 * exigência prática da LGPD para monitoramento em ambiente de trabalho.
 * Recusar é possível: o escritório continua funcionando, sem coleta.
 */
export function ConsentModal() {
  const boot = useStore((s) => s.boot)!;
  const [policy, setPolicy] = useState<ActivityPolicy | null>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!boot.online) return;
    Promise.all([getPolicy(), getConsents()])
      .then(([p, consents]) => {
        setPolicy(p);
        const office = consents.find((c) => c.scope === 'office');
        // Mostra se nunca aceitou, ou se a política mudou de versão.
        if (!office?.current) setOpen(true);
      })
      .catch(() => undefined);
  }, [boot.online]);

  if (!open || !policy) return null;

  const accept = async () => {
    setBusy(true);
    try {
      await acceptConsent('office');
      setOpen(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="absolute inset-0 z-[60] flex items-center justify-center bg-black/75 p-4">
      <div className="flex max-h-[88vh] w-[620px] max-w-[95vw] flex-col rounded-2xl border border-evoluze-border bg-evoluze-panel shadow-2xl">
        <header className="border-b border-evoluze-border p-5">
          <div className="text-[11px] font-medium uppercase tracking-wide text-evoluze-teal">
            Aviso de registro de atividade
          </div>
          <h2 className="mt-1 text-lg font-bold">Como o {boot.org.name} registra o trabalho</h2>
          <p className="mt-1 text-xs text-slate-400">
            Leia antes de continuar. Versão {policy.version}.
          </p>
        </header>

        <div className="thin-scroll flex-1 space-y-4 overflow-y-auto p-5 text-sm">
          <Block title="O que é registrado" tone="neutral" items={policy.collected} />
          <Block title="O que nunca é registrado" tone="good" items={policy.notCollected} />
          <Block title="Seus direitos" tone="neutral" items={policy.rights} />

          <div className="rounded-lg border border-evoluze-border bg-evoluze-dark/50 p-3">
            <div className="mb-1 text-xs font-semibold text-slate-200">Quem vê os relatórios</div>
            <p className="text-xs text-slate-400">{policy.visibility}</p>
          </div>
        </div>

        <footer className="flex flex-col gap-2 border-t border-evoluze-border p-4 sm:flex-row sm:justify-end">
          <button
            onClick={() => setOpen(false)}
            className="rounded-lg border border-evoluze-border px-4 py-2 text-sm text-slate-300 hover:text-white"
          >
            Agora não (sem registro)
          </button>
          <button
            onClick={accept}
            disabled={busy}
            className="rounded-lg bg-evoluze-teal px-5 py-2 text-sm font-semibold text-evoluze-dark disabled:opacity-50"
          >
            {busy ? 'Registrando…' : 'Li e concordo'}
          </button>
        </footer>
      </div>
    </div>
  );
}

function Block({
  title,
  items,
  tone,
}: {
  title: string;
  items: string[];
  tone: 'neutral' | 'good';
}) {
  return (
    <div>
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-evoluze-teal">{title}</h3>
      <ul className="space-y-1.5">
        {items.map((t, i) => (
          <li key={i} className="flex gap-2 text-slate-300">
            <span className={tone === 'good' ? 'text-emerald-400' : 'text-slate-500'}>
              {tone === 'good' ? '✓' : '•'}
            </span>
            <span className="text-xs leading-relaxed">{t}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
