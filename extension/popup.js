const $ = (id) => document.getElementById(id);
const send = (msg) => chrome.runtime.sendMessage(msg);

function fmt(sec) {
  const h = Math.floor(sec / 3600);
  const m = Math.round((sec % 3600) / 60);
  return h > 0 ? `${h}h ${m}min` : `${m}min`;
}

async function render() {
  const s = await send({ type: 'status' });
  $('setup').hidden = s.paired;
  $('main').hidden = !s.paired;
  if (!s.paired) return;

  $('state').textContent = s.paused ? 'pausado' : 'ativo';
  $('state').className = `pill ${s.paused ? 'off' : 'on'}`;
  $('toggle').textContent = s.paused ? 'Retomar registro' : 'Pausar registro';

  const meta = new Map((s.categories ?? []).map((c) => [c.id, c]));
  const cats = Object.entries(s.acc?.cats ?? {}).sort((a, b) => b[1] - a[1]);
  const total = cats.reduce((n, [, v]) => n + v, 0);
  $('total').textContent = fmt(total);

  $('cats').innerHTML =
    cats.length === 0
      ? '<div class="sub" style="margin:6px 0 0">Nada registrado ainda.</div>'
      : cats
          .map(([id, sec]) => {
            const m = meta.get(id);
            const pct = total ? Math.round((sec / total) * 100) : 0;
            return `<div style="margin-top:7px">
              <div class="row"><span>${m?.label ?? id}</span><span class="num">${fmt(sec)}</span></div>
              <div class="bar"><i style="width:${pct}%;background:${m?.color ?? '#5C6784'}"></i></div>
            </div>`;
          })
          .join('');

  // Lista local de domínios sem categoria (nunca sai daqui)
  const unk = Object.entries(s.unknown ?? {}).sort((a, b) => b[1] - a[1]);
  $('unkCard').hidden = unk.length === 0;
  $('unkCount').textContent = `${unk.length} site${unk.length === 1 ? '' : 's'}`;
  $('unk').innerHTML = unk
    .slice(0, 12)
    .map(
      ([host, sec]) =>
        `<div class="row"><span style="font-size:11px;color:#c7d3e8">${host}</span>` +
        `<span class="num" style="font-size:11px">${fmt(sec)}</span></div>`,
    )
    .join('');
  window.__unk = unk;

  $('err').hidden = !s.lastError;
  $('err').textContent = s.lastError ? `Falha ao enviar: ${s.lastError}` : '';
}

$('pair').addEventListener('click', async () => {
  const token = $('token').value.trim();
  const serverUrl = $('server').value.trim();
  if (!token || !serverUrl) return;
  await send({ type: 'pair', token, serverUrl });
  render();
});

$('toggle').addEventListener('click', async () => {
  const s = await send({ type: 'status' });
  await send({ type: 'pause', paused: !s.paused });
  render();
});

$('send').addEventListener('click', async () => {
  await send({ type: 'flush' });
  render();
});

$('copy').addEventListener('click', async () => {
  const list = (window.__unk ?? []).map(([h, s]) => `${h}  ${Math.round(s / 60)}min`).join('\n');
  await navigator.clipboard.writeText(list);
  $('copy').textContent = 'Copiado!';
  setTimeout(() => ($('copy').textContent = 'Copiar lista'), 1500);
});

$('clearUnk').addEventListener('click', async () => {
  await send({ type: 'clearUnknown' });
  render();
});

$('forget').addEventListener('click', async () => {
  if (!confirm('Desconectar e apagar os dados guardados neste navegador?')) return;
  await send({ type: 'forget' });
  render();
});

render();
