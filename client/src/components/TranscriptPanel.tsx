import { useEffect, useRef, useState } from 'react';
import { useStore } from '../store/useStore';
import { intervene } from '../hooks/useRealtime';

export function TranscriptPanel() {
  const phase = useStore((s) => s.meetingPhase);
  const meeting = useStore((s) => s.meeting);
  const messages = useStore((s) => s.meetingMessages);
  const thinkingId = useStore((s) => s.thinkingAgentId);
  const round = useStore((s) => s.round);
  const totalRounds = useStore((s) => s.totalRounds);
  const usage = useStore((s) => s.usage);
  const agentById = useStore((s) => s.agentById);
  const error = useStore((s) => s.meetingError);
  const minutes = useStore((s) => s.minutes);
  const setMinutesOpen = useStore((s) => s.setMinutesOpen);
  const resetMeeting = useStore((s) => s.resetMeeting);
  const [text, setText] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, thinkingId]);

  if (phase === 'idle' || !meeting) return null;

  const thinking = thinkingId ? agentById(thinkingId) : null;
  const budgetPct = Math.min(100, (usage.tokens / meeting.maxTokens) * 100);

  const sendIntervention = () => {
    const t = text.trim();
    if (!t) return;
    intervene(meeting.id, t);
    setText('');
  };

  return (
    <div className="absolute left-0 top-0 z-30 flex h-full w-[400px] flex-col border-r border-evoluze-border bg-evoluze-panel/95 shadow-2xl backdrop-blur">
      <header className="border-b border-evoluze-border p-4">
        <div className="flex items-start justify-between">
          <div>
            <div className="text-sm font-bold text-evoluze-teal">📋 {meeting.title}</div>
            <div className="mt-0.5 text-xs text-slate-400">Modo: {meeting.mode}</div>
          </div>
          <span className="rounded-full bg-evoluze-dark px-2 py-1 text-[10px] font-medium text-slate-300">
            {phase === 'seating'
              ? 'sentando…'
              : phase === 'running'
                ? `round ${round}/${totalRounds}`
                : 'encerrada'}
          </span>
        </div>

        {/* Custo em tempo real */}
        <div className="mt-3">
          <div className="mb-1 flex items-center justify-between text-[11px] text-slate-400">
            <span>🪙 {usage.tokens.toLocaleString('pt-BR')} tokens · ~US$ {usage.costUsd.toFixed(4)}</span>
            <span>{(meeting.maxTokens / 1000).toFixed(0)}k máx</span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-evoluze-dark">
            <div
              className="h-full rounded-full bg-evoluze-teal transition-all"
              style={{ width: `${budgetPct}%` }}
            />
          </div>
        </div>
      </header>

      <div className="thin-scroll flex-1 space-y-3 overflow-y-auto p-4">
        {phase === 'seating' && (
          <p className="text-center text-xs text-slate-500">
            Os agentes estão indo para a sala. Vá até a Sala de Reunião para começar.
          </p>
        )}
        {messages.map((m) => {
          if (m.speakerType === 'system')
            return (
              <div key={m.id} className="text-center text-[11px] italic text-slate-500">{m.content}</div>
            );
          const isUser = m.speakerType === 'user';
          const agent = m.speakerId ? agentById(m.speakerId) : null;
          const tint = isUser ? '#00D4C6' : agent?.avatarConfig.tint ?? '#888';
          return (
            <div key={m.id} className="animate-fade-in-up">
              <div className="mb-0.5 flex items-center gap-2">
                <span className="inline-block h-2 w-2 rounded-full" style={{ background: tint }} />
                <span className="text-xs font-semibold" style={{ color: tint }}>{m.speakerName}</span>
                <span className="text-[10px] text-slate-500">round {m.roundNumber}</span>
              </div>
              <div className={`rounded-lg px-3 py-2 text-sm ${isUser ? 'bg-evoluze-teal/10 text-slate-100' : 'bg-evoluze-dark/50 text-slate-200'}`}>
                {m.content}
              </div>
            </div>
          );
        })}
        {thinking && (
          <div className="flex items-center gap-2 text-xs italic text-slate-500">
            <span className="inline-flex gap-1">
              <Dot /> <Dot /> <Dot />
            </span>
            {thinking.name.split(' ')[0]} está pensando…
          </div>
        )}
        {error && <div className="rounded-lg bg-rose-500/10 p-2 text-xs text-rose-300">Erro: {error}</div>}
        <div ref={bottomRef} />
      </div>

      <footer className="border-t border-evoluze-border p-3">
        {phase === 'running' && (
          <>
            <div className="mb-1 text-[10px] text-slate-500">Intervenção do CEO (peso máximo, redireciona o round)</div>
            <div className="flex gap-2">
              <input
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && sendIntervention()}
                placeholder="Digite para intervir na reunião…"
                className="flex-1 rounded-lg border border-evoluze-border bg-evoluze-dark px-3 py-2 text-sm outline-none focus:border-evoluze-teal"
              />
              <button onClick={sendIntervention} className="rounded-lg bg-evoluze-teal px-3 py-2 text-sm font-semibold text-evoluze-dark">
                Intervir
              </button>
            </div>
          </>
        )}
        {phase === 'finished' && (
          <div className="flex gap-2">
            {minutes && (
              <button
                onClick={() => setMinutesOpen(true)}
                className="flex-1 rounded-lg bg-evoluze-teal px-3 py-2 text-sm font-semibold text-evoluze-dark"
              >
                Ver ata
              </button>
            )}
            <button
              onClick={resetMeeting}
              className="rounded-lg border border-evoluze-border px-3 py-2 text-sm text-slate-300 hover:text-white"
            >
              Fechar
            </button>
          </div>
        )}
      </footer>
    </div>
  );
}

function Dot() {
  return <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-500" style={{ animationDelay: `${Math.random() * 0.3}s` }} />;
}
