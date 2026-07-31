import { useEffect, useRef, useState } from 'react';
import { useStore } from '../store/useStore';
import { sendChat } from '../lib/api';
import { gameBus } from '../lib/gameBus';

export function ChatPanel() {
  const agentId = useStore((s) => s.chatAgentId);
  const agent = useStore((s) => (agentId ? s.agentById(agentId) : undefined));
  const messages = useStore((s) => s.chatMessages);
  const sending = useStore((s) => s.chatSending);
  const tokens = useStore((s) => s.chatTokens);
  const boot = useStore((s) => s.boot)!;
  const { closeChat, pushChat, setChatSending, addChatTokens } = useStore.getState();
  const [input, setInput] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, sending]);

  if (!agentId || !agent) return null;

  const close = () => {
    closeChat();
    if (useStore.getState().meetingPhase !== 'running') gameBus.emitT('input:lock', false);
  };

  const send = async () => {
    const text = input.trim();
    if (!text || sending) return;
    setErr(null);
    setInput('');
    pushChat({ role: 'user', content: text });
    setChatSending(true);
    try {
      const history = useStore.getState().chatMessages.map((m) => ({ role: m.role, content: m.content }));
      const res = await sendChat(agent.id, text, history.slice(0, -1));
      pushChat({ role: 'assistant', content: res.reply });
      addChatTokens(res.tokensIn, res.tokensOut, res.costUsd);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Erro');
    } finally {
      setChatSending(false);
    }
  };

  const tint = agent.avatarConfig.tint ?? '#00D4C6';

  return (
    <div className="absolute right-0 top-0 z-30 flex h-full w-[380px] flex-col border-l border-evoluze-border bg-evoluze-panel/95 shadow-2xl backdrop-blur">
      <header className="flex items-center gap-3 border-b border-evoluze-border p-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg text-sm font-bold text-evoluze-dark" style={{ background: tint }}>
          {agent.name.split(' ').map((w) => w[0]).slice(0, 2).join('')}
        </div>
        <div className="flex-1">
          <div className="text-sm font-semibold">{agent.name}</div>
          <div className="text-xs text-slate-400">{agent.jobTitle}</div>
        </div>
        <button onClick={close} className="rounded p-1 text-slate-400 hover:text-white">✕</button>
      </header>

      {!boot.features.llmEnabled && (
        <div className="border-b border-evoluze-border bg-rose-500/10 px-4 py-2 text-xs text-rose-300">
          Chat requer ANTHROPIC_API_KEY no servidor. Sem chave, o agente não responde.
        </div>
      )}

      <div className="thin-scroll flex-1 space-y-3 overflow-y-auto p-4">
        {messages.length === 0 && (
          <p className="text-center text-xs text-slate-500">
            Você chegou perto de {agent.name.split(' ')[0]}. Diga algo — essa conversa gasta tokens.
          </p>
        )}
        {messages.map((m, i) => (
          <div key={i} className={m.role === 'user' ? 'flex justify-end' : 'flex justify-start'}>
            <div
              className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${
                m.role === 'user'
                  ? 'bg-evoluze-teal text-evoluze-dark'
                  : 'border border-evoluze-border bg-evoluze-dark/60 text-slate-100'
              }`}
            >
              {m.content}
            </div>
          </div>
        ))}
        {sending && <div className="text-xs italic text-slate-500">{agent.name.split(' ')[0]} está digitando…</div>}
        {err && <div className="text-xs text-rose-400">{err}</div>}
        <div ref={bottomRef} />
      </div>

      <footer className="border-t border-evoluze-border p-3">
        <div className="mb-2 flex items-center justify-between text-[11px] text-slate-500">
          <span>🪙 tokens: {tokens.in + tokens.out}</span>
          <span>~US$ {tokens.costUsd.toFixed(4)}</span>
        </div>
        <div className="flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && send()}
            placeholder="Escreva uma mensagem…"
            disabled={!boot.features.llmEnabled}
            className="flex-1 rounded-lg border border-evoluze-border bg-evoluze-dark px-3 py-2 text-sm outline-none focus:border-evoluze-teal disabled:opacity-50"
          />
          <button
            onClick={send}
            disabled={sending || !input.trim() || !boot.features.llmEnabled}
            className="rounded-lg bg-evoluze-teal px-4 py-2 text-sm font-semibold text-evoluze-dark disabled:opacity-40"
          >
            ➤
          </button>
        </div>
      </footer>
    </div>
  );
}
