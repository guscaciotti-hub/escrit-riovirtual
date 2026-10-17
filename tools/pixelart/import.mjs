import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PNG } from 'pngjs';
import { Canvas } from './png.mjs';

/**
 * Importa a arte grande gerada por IA (assets-src/) e produz os spritesheets
 * na grade do jogo (client/public/assets/).
 *
 * O que ele faz, em ordem:
 *   1. recorta a região útil (uma imagem de 1024px costuma conter MUITO mais
 *      detalhe do que cabe num tile de 32px — ver `sourceTile` no config)
 *   2. reduz por média de área (mantém a forma; nearest puro serrilha demais)
 *   3. monta uma paleta única com todas as imagens (median cut)
 *   4. remapeia cada pixel para a cor mais próxima em espaço Lab — é isso que
 *      faz peças de gerações diferentes parecerem o mesmo jogo
 *   5. costura as bordas dos pisos para ficarem realmente tileáveis
 */

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '../..');
const SRC = join(ROOT, 'assets-src');
const OUT = join(ROOT, 'client/public/assets');
const T = 32, CW = 24, CH = 32;
const PALETTE_SIZE = 48;

/** Ordem dos tiles = GID do mapa. `seamless` costura as bordas. */
const TILES = [
  { file: '01-floor-wood', seamless: true },
  { file: '02-wall', seamless: false },
  { file: '03-desk', seamless: false },
  { file: '04-meeting-table', seamless: false },
  { file: '05-plant', seamless: false, alpha: true },
  { file: '06-grass', seamless: true },
  { file: '07-carpet-teal', seamless: true },
  { file: '08-carpet-blue', seamless: true },
];
const DIRS = ['down', 'left', 'right', 'up'];

// ---------- leitura ----------

function readPNG(path) {
  const png = PNG.sync.read(readFileSync(path));
  return { w: png.width, h: png.height, data: png.data };
}

/** Config opcional por asset: assets-src/import.config.json */
function loadConfig() {
  const p = join(SRC, 'import.config.json');
  return existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')) : {};
}

// ---------- redução ----------

/**
 * Reduz uma região para w x h por média de área, preservando alpha.
 * `crop` = [x, y, w, h] na imagem de origem.
 */
function downscale(img, tw, th, crop) {
  const [cx, cy, cw, chh] = crop ?? [0, 0, img.w, img.h];
  const out = new Uint8Array(tw * th * 4);
  const sx = cw / tw;
  const sy = chh / th;
  for (let y = 0; y < th; y++) {
    for (let x = 0; x < tw; x++) {
      let r = 0, g = 0, b = 0, a = 0, n = 0;
      const x0 = Math.floor(cx + x * sx), x1 = Math.max(x0 + 1, Math.floor(cx + (x + 1) * sx));
      const y0 = Math.floor(cy + y * sy), y1 = Math.max(y0 + 1, Math.floor(cy + (y + 1) * sy));
      for (let j = y0; j < y1; j++) {
        for (let i = x0; i < x1; i++) {
          if (i < 0 || j < 0 || i >= img.w || j >= img.h) continue;
          const k = (j * img.w + i) * 4;
          const al = img.data[k + 3] / 255;
          r += img.data[k] * al; g += img.data[k + 1] * al; b += img.data[k + 2] * al;
          a += img.data[k + 3];
          n++;
        }
      }
      if (!n) continue;
      const o = (y * tw + x) * 4;
      const aw = a / n / 255 || 1;
      out[o] = Math.round(r / n / aw);
      out[o + 1] = Math.round(g / n / aw);
      out[o + 2] = Math.round(b / n / aw);
      out[o + 3] = Math.round(a / n);
    }
  }
  return { w: tw, h: th, data: out };
}

// ---------- paleta ----------

const srgb = (v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
function toLab(r, g, b) {
  const R = srgb(r), G = srgb(g), B = srgb(b);
  let X = (R * 0.4124 + G * 0.3576 + B * 0.1805) / 0.95047;
  let Y = R * 0.2126 + G * 0.7152 + B * 0.0722;
  let Z = (R * 0.0193 + G * 0.1192 + B * 0.9505) / 1.08883;
  const f = (t) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  X = f(X); Y = f(Y); Z = f(Z);
  return [116 * Y - 16, 500 * (X - Y), 200 * (Y - Z)];
}

/** Median cut: reduz todas as cores vistas a N representativas. */
function buildPalette(images, size) {
  let box = [];
  for (const img of images) {
    for (let i = 0; i < img.data.length; i += 4) {
      if (img.data[i + 3] < 128) continue;
      box.push([img.data[i], img.data[i + 1], img.data[i + 2]]);
    }
  }
  if (box.length === 0) return [[0, 0, 0]];
  let boxes = [box];
  while (boxes.length < size) {
    // divide a caixa de maior amplitude
    let bi = -1, bRange = -1, bAxis = 0;
    boxes.forEach((bx, i) => {
      if (bx.length < 2) return;
      for (let ax = 0; ax < 3; ax++) {
        let lo = 255, hi = 0;
        for (const c of bx) { if (c[ax] < lo) lo = c[ax]; if (c[ax] > hi) hi = c[ax]; }
        if (hi - lo > bRange) { bRange = hi - lo; bi = i; bAxis = ax; }
      }
    });
    if (bi < 0) break;
    const bx = boxes[bi];
    bx.sort((p, q) => p[bAxis] - q[bAxis]);
    const mid = bx.length >> 1;
    boxes.splice(bi, 1, bx.slice(0, mid), bx.slice(mid));
  }
  return boxes.filter((b) => b.length).map((b) => {
    const s = b.reduce((a, c) => [a[0] + c[0], a[1] + c[1], a[2] + c[2]], [0, 0, 0]);
    return s.map((v) => Math.round(v / b.length));
  });
}

function quantize(img, palette) {
  const labs = palette.map(([r, g, b]) => toLab(r, g, b));
  const cache = new Map();
  for (let i = 0; i < img.data.length; i += 4) {
    if (img.data[i + 3] < 128) { img.data[i + 3] = 0; continue; }
    img.data[i + 3] = 255; // sem semitransparência: pixel art é binário no alpha
    const key = (img.data[i] << 16) | (img.data[i + 1] << 8) | img.data[i + 2];
    let idx = cache.get(key);
    if (idx === undefined) {
      const lab = toLab(img.data[i], img.data[i + 1], img.data[i + 2]);
      let best = 0, bd = Infinity;
      for (let p = 0; p < labs.length; p++) {
        const d = (lab[0] - labs[p][0]) ** 2 + (lab[1] - labs[p][1]) ** 2 + (lab[2] - labs[p][2]) ** 2;
        if (d < bd) { bd = d; best = p; }
      }
      idx = best;
      cache.set(key, idx);
    }
    img.data[i] = palette[idx][0];
    img.data[i + 1] = palette[idx][1];
    img.data[i + 2] = palette[idx][2];
  }
  return img;
}

/** Força o encaixe: mistura as bordas opostas para o tile repetir sem emenda. */
function makeSeamless(img) {
  const { w, h, data } = img;
  const mix = (ia, ib) => {
    for (let c = 0; c < 3; c++) {
      const v = Math.round((data[ia + c] + data[ib + c]) / 2);
      data[ia + c] = v;
      data[ib + c] = v;
    }
  };
  for (let x = 0; x < w; x++) mix((0 * w + x) * 4, ((h - 1) * w + x) * 4);
  for (let y = 0; y < h; y++) mix((y * w + 0) * 4, (y * w + (w - 1)) * 4);
  return img;
}

function blit(canvas, img, dx, dy) {
  for (let y = 0; y < img.h; y++)
    for (let x = 0; x < img.w; x++) {
      const i = (y * img.w + x) * 4;
      if (img.data[i + 3] === 0) continue;
      const o = ((dy + y) * canvas.width + (dx + x)) * 4;
      canvas.data[o] = img.data[i];
      canvas.data[o + 1] = img.data[i + 1];
      canvas.data[o + 2] = img.data[i + 2];
      canvas.data[o + 3] = 255;
    }
}

// ---------- execução ----------

const cfg = loadConfig();
const found = [];
const missing = [];

/** Resolve o recorte: `sourceTile` diz quantos px da origem valem 1 tile. */
function cropFor(img, name) {
  const c = cfg[name];
  if (c?.crop) return c.crop;
  if (c?.sourceTile) {
    const s = Math.min(c.sourceTile, img.w, img.h);
    return [Math.floor((img.w - s) / 2), Math.floor((img.h - s) / 2), s, s];
  }
  return null;
}

// tiles
const tileImgs = [];
for (const t of TILES) {
  const path = join(SRC, 'tiles', `${t.file}.png`);
  if (!existsSync(path)) { missing.push(`tiles/${t.file}.png`); tileImgs.push(null); continue; }
  const src = readPNG(path);
  let img = downscale(src, T, T, cropFor(src, t.file));
  if (t.seamless) img = makeSeamless(img);
  tileImgs.push(img);
  found.push(`tiles/${t.file}.png (${src.w}x${src.h})`);
}

// personagens
const charFiles = existsSync(join(SRC, 'chars')) ? readdirSync(join(SRC, 'chars')).filter((f) => f.endsWith('.png')) : [];
const looks = [...new Set(charFiles.map((f) => f.split('-')[0]))].sort();
const charImgs = new Map();
for (const f of charFiles) {
  const src = readPNG(join(SRC, 'chars', f));
  charImgs.set(f.replace('.png', ''), downscale(src, CW, CH, cropFor(src, f.replace('.png', ''))));
}

// paleta única entre tudo
const all = [...tileImgs.filter(Boolean), ...charImgs.values()];
if (all.length === 0) {
  console.log('[import] nenhuma arte em assets-src/. Nada a fazer.');
  console.log('[import] esperado:', TILES.map((t) => `tiles/${t.file}.png`).join(', '));
  process.exit(0);
}
const palette = buildPalette(all, PALETTE_SIZE);
all.forEach((img) => quantize(img, palette));

mkdirSync(join(OUT, 'tilesets'), { recursive: true });
mkdirSync(join(OUT, 'characters'), { recursive: true });

// tileset: mantém o que já existe para os tiles que ainda não chegaram
if (tileImgs.some(Boolean)) {
  const sheet = new Canvas(T * TILES.length, T);
  const existing = existsSync(join(OUT, 'tilesets/office.png')) ? readPNG(join(OUT, 'tilesets/office.png')) : null;
  TILES.forEach((t, i) => {
    if (tileImgs[i]) blit(sheet, tileImgs[i], i * T, 0);
    else if (existing) {
      // preserva o tile gerado proceduralmente até a arte real chegar
      const slice = { w: T, h: T, data: new Uint8Array(T * T * 4) };
      for (let y = 0; y < T; y++)
        for (let x = 0; x < T; x++) {
          const k = (y * existing.w + i * T + x) * 4;
          const o = (y * T + x) * 4;
          slice.data.set(existing.data.subarray(k, k + 4), o);
        }
      blit(sheet, slice, i * T, 0);
    }
  });
  writeFileSync(join(OUT, 'tilesets/office.png'), sheet.toPNG());
  console.log(`[import] tileset  -> ${TILES.filter((_, i) => tileImgs[i]).length}/${TILES.length} tiles da arte real`);
}

// personagens: looks x 3 frames de largura, 4 direções de altura
if (charImgs.size) {
  const sheet = new Canvas(looks.length * 3 * CW, 4 * CH);
  looks.forEach((look, v) => {
    DIRS.forEach((dir, d) => {
      for (let f = 0; f < 3; f++) {
        const img = charImgs.get(`${look}-${dir}-${f}`) ?? charImgs.get(`${look}-${dir}-0`);
        if (img) blit(sheet, img, (v * 3 + f) * CW, d * CH);
      }
    });
  });
  writeFileSync(join(OUT, 'characters/people.png'), sheet.toPNG());
  console.log(`[import] personagens -> ${looks.length} visual(is): ${looks.join(', ')}`);
}

console.log(`[import] paleta unificada: ${palette.length} cores`);
if (found.length) console.log('[import] usados:\n  ' + found.join('\n  '));
if (missing.length) console.log('[import] ainda faltam:\n  ' + missing.join('\n  '));
