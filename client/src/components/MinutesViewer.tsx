import { jsPDF } from 'jspdf';
import { minutesToMarkdown } from '@evoluze/shared';
import { useStore } from '../store/useStore';
import { minutesExportUrl } from '../lib/api';

export function MinutesViewer() {
  const open = useStore((s) => s.minutesOpen);
  const setOpen = useStore((s) => s.setMinutesOpen);
  const minutes = useStore((s) => s.minutes);
  const meeting = useStore((s) => s.meeting);
  const boot = useStore((s) => s.boot)!;

  if (!open || !minutes || !meeting) return null;

  const downloadMd = () => {
    if (boot.online) {
      window.open(minutesExportUrl(meeting.id), '_blank');
      return;
    }
    const md = minutesToMarkdown(meeting, minutes);
    const blob = new Blob([md], { type: 'text/markdown' });
    triggerDownload(URL.createObjectURL(blob), `ata-${meeting.id}.md`);
  };

  const downloadPdf = () => {
    const doc = new jsPDF({ unit: 'pt', format: 'a4' });
    const margin = 48;
    let y = margin;
    const width = doc.internal.pageSize.getWidth() - margin * 2;
    const line = (text: string, size = 11, color = '#111', gap = 16, bold = false) => {
      doc.setFontSize(size);
      doc.setTextColor(color);
      doc.setFont('helvetica', bold ? 'bold' : 'normal');
      for (const l of doc.splitTextToSize(text, width)) {
        if (y > doc.internal.pageSize.getHeight() - margin) {
          doc.addPage();
          y = margin;
        }
        doc.text(l, margin, y);
        y += gap;
      }
    };
    doc.setFillColor('#0B1220');
    doc.rect(0, 0, doc.internal.pageSize.getWidth(), 6, 'F');
    line(`Ata — ${meeting.title}`, 18, '#0B1220', 26, true);
    line(`Pauta: ${meeting.agenda}`, 10, '#555', 15);
    line(`Modo: ${meeting.mode}`, 10, '#555', 22);
    line('Resumo executivo', 13, '#00A99D', 20, true);
    line(minutes.summary || '—', 11, '#222', 15);
    y += 8;
    line('Decisões', 13, '#00A99D', 20, true);
    minutes.decisions.forEach((d, i) => {
      line(`${i + 1}. ${d.decision}`, 11, '#222', 15, true);
      if (d.rationale) line(`   ${d.rationale}`, 10, '#555', 14);
    });
    if (minutes.decisions.length === 0) line('—', 11, '#222', 15);
    y += 8;
    line('Action items', 13, '#00A99D', 20, true);
    minutes.actionItems.forEach((a) => line(`• ${a.task} — ${a.owner || '—'} (${a.dueSuggestion || '—'})`, 11, '#222', 15));
    if (minutes.actionItems.length === 0) line('—', 11, '#222', 15);
    y += 8;
    line('Pontos em aberto (decisão do CEO)', 13, '#00A99D', 20, true);
    minutes.openQuestions.forEach((q) => line(`• ${q}`, 11, '#222', 15));
    if (minutes.openQuestions.length === 0) line('—', 11, '#222', 15);
    doc.save(`ata-${meeting.id}.pdf`);
  };

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setOpen(false)}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[85vh] w-[640px] max-w-[94vw] flex-col rounded-2xl border border-evoluze-border bg-evoluze-panel shadow-2xl"
      >
        <header className="flex items-center justify-between border-b border-evoluze-border p-5">
          <div>
            <div className="text-xs font-medium uppercase tracking-wide text-evoluze-teal">Ata da reunião</div>
            <h2 className="text-lg font-bold">{meeting.title}</h2>
          </div>
          <button onClick={() => setOpen(false)} className="rounded p-1 text-slate-400 hover:text-white">✕</button>
        </header>

        <div className="thin-scroll flex-1 space-y-5 overflow-y-auto p-5 text-sm">
          <Section title="Resumo executivo">
            <p className="whitespace-pre-wrap text-slate-200">{minutes.summary || '—'}</p>
          </Section>
          <Section title="Decisões">
            {minutes.decisions.length ? (
              <ol className="list-decimal space-y-2 pl-5">
                {minutes.decisions.map((d, i) => (
                  <li key={i}>
                    <span className="font-medium text-slate-100">{d.decision}</span>
                    {d.rationale && <span className="block text-xs text-slate-400">{d.rationale}</span>}
                  </li>
                ))}
              </ol>
            ) : (
              <p className="text-slate-500">—</p>
            )}
          </Section>
          <Section title="Action items">
            {minutes.actionItems.length ? (
              <ul className="space-y-2">
                {minutes.actionItems.map((a, i) => (
                  <li key={i} className="flex items-start gap-2 rounded-lg border border-evoluze-border bg-evoluze-dark/40 p-2">
                    <input type="checkbox" className="mt-1 accent-evoluze-teal" />
                    <div>
                      <div className="text-slate-100">{a.task}</div>
                      <div className="text-xs text-slate-400">
                        {a.owner || '—'} · prazo: {a.dueSuggestion || '—'}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-slate-500">—</p>
            )}
          </Section>
          <Section title="Pontos em aberto (sua decisão)">
            {minutes.openQuestions.length ? (
              <ul className="list-disc space-y-1 pl-5 text-slate-200">
                {minutes.openQuestions.map((q, i) => (
                  <li key={i}>{q}</li>
                ))}
              </ul>
            ) : (
              <p className="text-slate-500">—</p>
            )}
          </Section>
        </div>

        <footer className="flex justify-end gap-2 border-t border-evoluze-border p-4">
          <button onClick={downloadMd} className="rounded-lg border border-evoluze-border px-4 py-2 text-sm text-slate-200 hover:border-evoluze-teal/50">
            ⬇ Markdown
          </button>
          <button onClick={downloadPdf} className="rounded-lg bg-evoluze-teal px-4 py-2 text-sm font-semibold text-evoluze-dark">
            ⬇ PDF
          </button>
        </footer>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-evoluze-teal">{title}</h3>
      {children}
    </div>
  );
}

function triggerDownload(url: string, filename: string) {
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
}
