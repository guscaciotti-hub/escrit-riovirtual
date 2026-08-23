/**
 * Evoluze — Registro de Atividade (service worker MV3)
 *
 * GARANTIA DE PRIVACIDADE, por construção:
 * a URL da aba é lida em memória, convertida em CATEGORIA na hora, e descartada.
 * Nada de URL, título ou histórico é gravado em disco nem enviado ao servidor.
 * O que sai daqui é apenas: { category, seconds }.
 */

const FLUSH_MINUTES = 5;
const TICK_MINUTES = 1;
const IDLE_AFTER_SECONDS = 300;

const DEFAULT_STATE = {
  paired: null, // { token, serverUrl }
  paused: false,
  currentCategory: null,
  lastTickAt: null,
  acc: { date: today(), cats: {}, idle: 0 },
  catMap: null, // { domains, categories }
  unknown: {}, // { dominio: segundos } — LOCAL, nunca enviado
};

function today() {
  return new Date().toISOString().slice(0, 10);
}

async function getState() {
  const s = await chrome.storage.local.get('state');
  return { ...DEFAULT_STATE, ...(s.state ?? {}) };
}

async function setState(patch) {
  const cur = await getState();
  const next = { ...cur, ...patch };
  await chrome.storage.local.set({ state: next });
  return next;
}

/** Resolve hostname -> categoria usando o mapa em cache. Roda só aqui. */
function categorize(hostname, catMap) {
  const host = String(hostname).toLowerCase().replace(/^www\./, '');
  const domains = catMap?.domains ?? {};
  if (domains[host]) return { category: domains[host], host, known: true };
  const parts = host.split('.');
  for (let i = 1; i < parts.length - 1; i++) {
    const parent = parts.slice(i).join('.');
    if (domains[parent]) return { category: domains[parent], host, known: true };
  }
  return { category: 'outros', host, known: false };
}

/**
 * Qual a categoria da aba ativa agora? A URL morre dentro desta função.
 * Retorna { category, host, known } — `host` é usado APENAS para a lista local
 * de não classificados (ver `unknown` no storage) e nunca é transmitido.
 */
async function currentCategory(state) {
  try {
    const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
    if (!tab || !tab.url) return null;
    const url = new URL(tab.url);
    if (!/^https?:$/.test(url.protocol)) return null;
    return categorize(url.hostname, state.catMap);
  } catch {
    return null;
  }
}

/** Fecha o intervalo aberto e credita o tempo à categoria anterior. */
async function tick(reason) {
  const state = await getState();
  const now = Date.now();

  if (state.acc.date !== today()) {
    await flush();
    return;
  }

  if (state.lastTickAt && !state.paused) {
    const seconds = Math.round((now - state.lastTickAt) / 1000);
    if (seconds > 0 && seconds < 3600) {
      const idle = await chrome.idle.queryState(IDLE_AFTER_SECONDS);
      const acc = { ...state.acc, cats: { ...state.acc.cats } };
      const unknown = { ...(state.unknown ?? {}) };
      if (idle !== 'active') {
        acc.idle += seconds;
      } else if (state.currentCategory) {
        const cat = state.currentCategory.category;
        acc.cats[cat] = (acc.cats[cat] ?? 0) + seconds;
        // Lista de ajuda para calibrar o mapa de categorias.
        // FICA SÓ NESTE NAVEGADOR — nunca entra em nenhum payload enviado.
        if (!state.currentCategory.known && state.currentCategory.host) {
          const h = state.currentCategory.host;
          unknown[h] = (unknown[h] ?? 0) + seconds;
        }
      }
      await setState({ acc, unknown });
    }
  }

  const next = state.paused ? null : await currentCategory(await getState());
  await setState({ currentCategory: next, lastTickAt: now });
}

/** Envia o acumulado. Só categoria + segundos. */
async function flush() {
  const state = await getState();
  if (!state.paired) return;
  const { cats, idle, date } = state.acc;
  const entries = Object.entries(cats)
    .map(([category, seconds]) => ({ category, seconds: Math.round(seconds) }))
    .filter((e) => e.seconds > 0);
  if (entries.length === 0 && idle <= 0) {
    await setState({ acc: { date: today(), cats: {}, idle: 0 } });
    return;
  }
  try {
    const res = await fetch(`${state.paired.serverUrl}/api/extension/ingest`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-extension-token': state.paired.token,
      },
      body: JSON.stringify({ date, entries, idleSeconds: Math.round(idle) }),
    });
    if (res.ok) {
      await setState({ acc: { date: today(), cats: {}, idle: 0 }, lastError: null });
    } else {
      const body = await res.json().catch(() => ({}));
      await setState({ lastError: body.error ? JSON.stringify(body.error) : `HTTP ${res.status}` });
    }
  } catch (err) {
    await setState({ lastError: String(err) });
  }
}

/** Busca o mapa de categorias do servidor (uma vez por dia). */
async function refreshCategoryMap() {
  const state = await getState();
  if (!state.paired) return;
  try {
    const res = await fetch(`${state.paired.serverUrl}/api/extension/categories`);
    if (res.ok) await setState({ catMap: await res.json() });
  } catch {
    /* mantém o cache anterior */
  }
}

// ---- Gatilhos ----
chrome.runtime.onInstalled.addListener(() => {
  chrome.alarms.create('tick', { periodInMinutes: TICK_MINUTES });
  chrome.alarms.create('flush', { periodInMinutes: FLUSH_MINUTES });
  chrome.alarms.create('catmap', { periodInMinutes: 720 });
  refreshCategoryMap();
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'tick') tick('alarm');
  else if (alarm.name === 'flush') flush();
  else if (alarm.name === 'catmap') refreshCategoryMap();
});

chrome.tabs.onActivated.addListener(() => tick('tab'));
chrome.tabs.onUpdated.addListener((_id, info) => {
  if (info.status === 'complete') tick('nav');
});
chrome.windows.onFocusChanged.addListener(() => tick('focus'));
chrome.idle.setDetectionInterval(IDLE_AFTER_SECONDS);
chrome.idle.onStateChanged.addListener(() => tick('idle'));

// ---- API para o popup ----
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  (async () => {
    if (msg.type === 'status') {
      const s = await getState();
      sendResponse({
        paired: !!s.paired,
        serverUrl: s.paired?.serverUrl ?? null,
        paused: s.paused,
        acc: s.acc,
        categories: s.catMap?.categories ?? [],
        unknown: s.unknown ?? {},
        lastError: s.lastError ?? null,
      });
    } else if (msg.type === 'pair') {
      await setState({
        paired: { token: msg.token, serverUrl: msg.serverUrl.replace(/\/$/, '') },
      });
      await refreshCategoryMap();
      sendResponse({ ok: true });
    } else if (msg.type === 'unpair') {
      await flush();
      await setState({ paired: null, acc: { date: today(), cats: {}, idle: 0 } });
      sendResponse({ ok: true });
    } else if (msg.type === 'pause') {
      await tick('pause');
      await setState({ paused: !!msg.paused, currentCategory: null });
      sendResponse({ ok: true, paused: !!msg.paused });
    } else if (msg.type === 'flush') {
      await tick('manual');
      await flush();
      sendResponse({ ok: true });
    } else if (msg.type === 'clearUnknown') {
      await setState({ unknown: {} });
      sendResponse({ ok: true });
    } else if (msg.type === 'forget') {
      await chrome.storage.local.clear();
      sendResponse({ ok: true });
    }
  })();
  return true;
});
