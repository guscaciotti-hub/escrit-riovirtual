import { useState } from 'react';
import { login, setToken } from '../lib/api';

/** Tela de entrada. O escritório só abre depois daqui. */
export function LoginScreen({ onDone }: { onDone: () => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      const res = await login(email, password);
      setToken(res.token);
      onDone();
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : 'Não foi possível entrar.');
      setBusy(false);
    }
  };

  return (
    <div className="flex h-full items-center justify-center bg-[#1a1410] p-4">
      <div className="w-[380px] max-w-full">
        <div className="mb-6 text-center">
          <div className="text-3xl">🏢</div>
          <h1 className="mt-2 text-xl font-bold text-[#E8D5B0]">Escritório Evoluze</h1>
          <p className="mt-1 text-xs text-[#9A8468]">Entre para andar pelo escritório</p>
        </div>

        <form
          onSubmit={submit}
          className="rounded-2xl border border-[#4A3828] bg-[#241B14] p-5 shadow-2xl"
        >
          <label className="mb-1 block text-xs font-medium text-[#C4AD8C]">E-mail</label>
          <input
            type="email"
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mb-3 w-full rounded-lg border border-[#4A3828] bg-[#1A130E] px-3 py-2 text-sm text-[#E8D5B0] outline-none focus:border-[#3FA89E]"
            required
          />

          <label className="mb-1 block text-xs font-medium text-[#C4AD8C]">Senha</label>
          <input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mb-4 w-full rounded-lg border border-[#4A3828] bg-[#1A130E] px-3 py-2 text-sm text-[#E8D5B0] outline-none focus:border-[#3FA89E]"
            required
          />

          {err && (
            <div className="mb-3 rounded-lg bg-[#4A1F1F] px-3 py-2 text-xs text-[#FFB4B4]">{err}</div>
          )}

          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-lg bg-[#3FA89E] px-4 py-2.5 text-sm font-semibold text-[#10201E] transition hover:brightness-110 disabled:opacity-50"
          >
            {busy ? 'Entrando…' : 'Entrar'}
          </button>
        </form>

        <p className="mt-4 text-center text-[11px] text-[#7A6650]">
          Não tem acesso? Peça ao gestor para cadastrar você.
        </p>
      </div>
    </div>
  );
}
