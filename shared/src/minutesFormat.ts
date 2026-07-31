import type { Meeting, MeetingMinutes } from './index.js';

/** Formata a ata como Markdown (usado para export .md e como base do PDF). */
export function minutesToMarkdown(meeting: Pick<Meeting, 'title' | 'agenda' | 'mode'>, m: MeetingMinutes): string {
  const lines: string[] = [];
  lines.push(`# Ata — ${meeting.title}`);
  lines.push('');
  lines.push(`**Pauta:** ${meeting.agenda}`);
  lines.push(`**Modo:** ${meeting.mode}`);
  lines.push('');
  lines.push('## Resumo executivo');
  lines.push(m.summary || '_(sem resumo)_');
  lines.push('');
  lines.push('## Decisões');
  if (m.decisions.length === 0) lines.push('_Nenhuma decisão registrada._');
  m.decisions.forEach((d, i) => {
    lines.push(`${i + 1}. **${d.decision}**`);
    if (d.rationale) lines.push(`   - _Justificativa:_ ${d.rationale}`);
  });
  lines.push('');
  lines.push('## Action items');
  if (m.actionItems.length === 0) lines.push('_Nenhum item de ação._');
  m.actionItems.forEach((a) => {
    lines.push(`- [ ] **${a.task}** — responsável: ${a.owner || '—'} · prazo: ${a.dueSuggestion || '—'}`);
  });
  lines.push('');
  lines.push('## Pontos em aberto (decisão do CEO)');
  if (m.openQuestions.length === 0) lines.push('_Nenhum ponto em aberto._');
  m.openQuestions.forEach((q) => lines.push(`- ${q}`));
  lines.push('');
  lines.push(`_Gerado em ${new Date(m.createdAt).toLocaleString('pt-BR')}._`);
  return lines.join('\n');
}
