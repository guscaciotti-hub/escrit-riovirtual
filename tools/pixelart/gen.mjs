import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Canvas } from './png.mjs';

/**
 * Gera a arte do escritório em pixel art, estilo GBA (Pokémon Gen 3):
 * paleta quente, contorno escuro suave, 32x32 por tile.
 *
 * Saída:
 *   client/public/assets/tilesets/office.png   (8 tiles em linha)
 *   client/public/assets/characters/people.png (6 visuais x 4 direcoes x 3 frames)
 */

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(__dirname, '../../client/public/assets');
const T = 32; // tile
const CW = 24; // largura do personagem
const CH = 32; // altura do personagem

// ---------- paleta ----------
const P = {
  // madeira
  wood: '#C98D54', woodDark: '#AE7542', woodLite: '#DCA76B',
  // carpetes
  teal: '#3FA89E', tealDark: '#2F8C84',
  blue: '#5E86B8', blueDark: '#4A6E9C',
  warm: '#C8766A', warmDark: '#A85E56',
  // parede
  wallTop: '#9A7352', wallTopLite: '#B38C65', wallFace: '#F3E6CB', wallShade: '#D8C09A',
  // móveis
  desk: '#A9713F', deskTop: '#C2894F', deskEdge: '#7E5229',
  screen: '#2F3A4C', screenGlow: '#7FD8CC',
  tableTop: '#C89B62', tableEdge: '#966B3C',
  leaf: '#4E9A3F', leafDark: '#3A7A2E', pot: '#B5663C', potDark: '#8E4B2A',
  // traço
  ink: '#3A2A1E',
  shadow: '#00000033',
};

/** ruído determinístico 0..1 */
const noise = (x, y) => {
  const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return n - Math.floor(n);
};

// ---------- tiles ----------

function floorWood(c, ox) {
  c.rect(ox, 0, T, T, P.wood);
  // duas tábuas de 16px por tile (período 16 mantém o encaixe lado a lado)
  for (let y = 0; y < T; y++) {
    for (let x = 0; x < T; x++) {
      // veio da madeira: riscos horizontais longos e sutis
      const grain = noise(Math.floor(x / 5) + ox, y);
      if (grain > 0.90) c.px(ox + x, y, P.woodLite);
      else if (grain < 0.055) c.px(ox + x, y, P.woodDark);
    }
  }
  // junta entre tábuas
  for (let x = 0; x < T; x++) {
    c.px(ox + x, 15, P.woodDark);
    c.px(ox + x, 31, P.woodDark);
    c.px(ox + x, 16, P.woodLite);
    c.px(ox + x, 0, P.woodLite);
  }
  // topo de tábua, alternado — dá o escalonamento de assoalho
  for (let y = 0; y < 15; y++) c.px(ox + 7, y, P.woodDark);
  for (let y = 16; y < 31; y++) c.px(ox + 23, y, P.woodDark);
}

function carpet(c, ox, base, dark) {
  c.rect(ox, 0, T, T, base);
  for (let y = 0; y < T; y++)
    for (let x = 0; x < T; x++) {
      if ((x + y) % 4 === 0) c.px(ox + x, y, dark);            // trama
      else if (noise(x + ox + 9, y) > 0.92) c.px(ox + x, y, dark);
    }
}

function wall(c, ox) {
  // topo do bloco (o que se vê "por cima") + face da parede, como no GBA
  c.rect(ox, 0, T, 12, P.wallTop);
  c.rect(ox, 0, T, 3, P.wallTopLite);
  c.rect(ox, 12, T, T - 12, P.wallFace);
  for (let x = 0; x < T; x++) c.px(ox + x, 12, P.ink);
  // rodapé
  c.rect(ox, T - 5, T, 5, P.wallShade);
  for (let x = 0; x < T; x++) c.px(ox + x, T - 5, P.ink);
  // tijolinho discreto no topo
  for (let y = 4; y < 12; y += 4)
    for (let x = 0; x < T; x++) if ((x + y) % 16 < 1) c.px(ox + x, y, P.wallTopLite);
}

function desk(c, ox) {
  floorWood(c, ox);
  // mesa
  c.rect(ox + 1, 10, T - 2, 16, P.desk);
  c.rect(ox + 1, 10, T - 2, 4, P.deskTop);
  c.stroke(ox + 1, 10, T - 2, 16, P.deskEdge);
  // monitor
  c.rect(ox + 8, 2, 16, 11, P.screen);
  c.rect(ox + 10, 4, 12, 7, P.screenGlow);
  c.rect(ox + 14, 13, 4, 3, P.screen);
  c.stroke(ox + 8, 2, 16, 11, P.ink);
  // teclado
  c.rect(ox + 9, 18, 14, 4, P.wallShade);
  c.stroke(ox + 9, 18, 14, 4, P.deskEdge);
  // sombra no chão
  c.rect(ox + 2, 26, T - 4, 2, P.shadow);
}

function meetingTable(c, ox) {
  carpet(c, ox, P.blue, P.blueDark);
  c.rect(ox, 6, T, 20, P.tableTop);
  c.rect(ox, 6, T, 3, '#DBB37C');
  for (let x = 0; x < T; x++) { c.px(ox + x, 6, P.tableEdge); c.px(ox + x, 25, P.tableEdge); }
  for (let y = 7; y < 25; y++) if (noise(ox + y, 3) > 0.9) c.px(ox + 5 + ((y * 7) % 20), y, '#DBB37C');
  c.rect(ox, 26, T, 2, P.shadow);
}

function plant(c, ox) {
  // vaso
  c.rect(ox + 9, 20, 14, 10, P.pot);
  c.rect(ox + 9, 20, 14, 3, '#C9794C');
  c.stroke(ox + 9, 20, 14, 10, P.potDark);
  // folhagem
  c.ellipse(ox + 16, 13, 10, 9, P.leaf);
  c.ellipse(ox + 12, 10, 5, 5, P.leafDark);
  c.ellipse(ox + 20, 15, 4, 4, P.leafDark);
  for (let i = 0; i < 26; i++) {
    const a = (i / 26) * Math.PI * 2;
    c.px(ox + 16 + Math.cos(a) * 9, 13 + Math.sin(a) * 8, P.leafDark);
  }
  c.ellipse(ox + 16, 30, 9, 2, P.shadow);
}

function grassFloor(c, ox) {
  c.rect(ox, 0, T, T, '#6FBF4A');
  for (let y = 0; y < T; y++)
    for (let x = 0; x < T; x++) {
      const n = noise(x + ox + 31, y + 7);
      if (n > 0.93) c.px(ox + x, y, '#5BA83C');
      else if (n < 0.05) c.px(ox + x, y, '#84CF5C');
    }
}

/** Monta o tileset na ordem dos GIDs usados pelo mapa (1..8). */
function buildTileset() {
  const tiles = [
    (c, ox) => floorWood(c, ox),                       // 1 piso open space
    (c, ox) => wall(c, ox),                            // 2 parede
    (c, ox) => desk(c, ox),                            // 3 mesa
    (c, ox) => meetingTable(c, ox),                    // 4 mesa de reunião
    (c, ox) => plant(c, ox),                           // 5 planta (furniture_top)
    (c, ox) => grassFloor(c, ox),                      // 6 lounge
    (c, ox) => carpet(c, ox, P.teal, P.tealDark),      // 7 sala do CEO
    (c, ox) => carpet(c, ox, P.blue, P.blueDark),      // 8 sala de reunião
  ];
  const c = new Canvas(T * tiles.length, T);
  tiles.forEach((fn, i) => fn(c, i * T));
  return c;
}

// ---------- personagens ----------

const LOOKS = [
  { skin: '#F0C9A0', hair: '#3B2A1F', shirt: '#2FA89E', pants: '#3C4A63' }, // teal (CEO)
  { skin: '#E8B98C', hair: '#6B3F22', shirt: '#D4704F', pants: '#44506B' },
  { skin: '#F5D3AE', hair: '#C9A227', shirt: '#7B61C9', pants: '#363E52' },
  { skin: '#C98B63', hair: '#241A14', shirt: '#4E9A3F', pants: '#4A3B5C' },
  { skin: '#F0C9A0', hair: '#8A2F2F', shirt: '#E0A53C', pants: '#2F4858' },
  { skin: '#D9A87C', hair: '#2E2E38', shirt: '#4E86C9', pants: '#5C4033' },
];

/**
 * Desenha um personagem 24x32.
 * dir: 0=baixo 1=esquerda 2=direita 3=cima · frame: 0 parado, 1 e 2 passos
 */
function mirror(src) {
  const out = new Canvas(src.width, src.height);
  for (let y = 0; y < src.height; y++)
    for (let x = 0; x < src.width; x++) {
      const i = (y * src.width + x) * 4;
      const o = (y * src.width + (src.width - 1 - x)) * 4;
      out.data[o] = src.data[i]; out.data[o + 1] = src.data[i + 1];
      out.data[o + 2] = src.data[i + 2]; out.data[o + 3] = src.data[i + 3];
    }
  return out;
}

function drawChar(c, look, dir, frame) {
  const ink = P.ink;
  const bob = frame === 0 ? 0 : 1; // leve sobe-desce ao andar
  const y0 = bob;

  const side = dir === 1;          // perfil (o 'direita' nasce espelhando este)
  const back = dir === 3;

  // sombra sempre no chão, nunca acompanha o bob
  c.ellipse(12, 30, 7, 2, P.shadow);

  // ---- pernas: passada de 2px, alternada ----
  const legY = 23 + y0;
  const step = frame === 1 ? 2 : frame === 2 ? -2 : 0;
  const lx = side ? 10 : 8;        // de perfil as pernas se sobrepõem
  const rx = side ? 12 : 13;
  c.rect(lx, legY + Math.max(0, step), 3, 5 - Math.abs(step) / 2, look.pants);
  c.rect(rx, legY + Math.max(0, -step), 3, 5 - Math.abs(step) / 2, look.pants);
  c.rect(lx, legY + 5 + Math.max(0, step) - Math.abs(step) / 2, 3, 2, ink);
  c.rect(rx, legY + 5 + Math.max(0, -step) - Math.abs(step) / 2, 3, 2, ink);

  // ---- corpo ----
  const bw = side ? 8 : 10;
  const bx = side ? 8 : 7;
  c.rect(bx, 15 + y0, bw, 9, look.shirt);
  c.stroke(bx, 15 + y0, bw, 9, ink);

  // braços: balançam ao contrário das pernas
  const armDrop = frame === 0 ? 0 : frame === 1 ? -1 : 1;
  if (side) {
    c.rect(bx + 2, 16 + y0 + armDrop, 3, 6, look.shirt);
    c.rect(bx + 2, 22 + y0 + armDrop, 3, 2, look.skin);
    c.stroke(bx + 2, 16 + y0 + armDrop, 3, 8, ink);
  } else {
    c.rect(5, 16 + y0 - armDrop, 2, 6, look.shirt);
    c.rect(17, 16 + y0 + armDrop, 2, 6, look.shirt);
    c.rect(5, 22 + y0 - armDrop, 2, 2, look.skin);
    c.rect(17, 22 + y0 + armDrop, 2, 2, look.skin);
  }

  // ---- cabeça ----
  const hw = side ? 12 : 14;
  const hx = side ? 6 : 5;
  const hy = 3 + y0, hh = 13;
  c.rect(hx, hy, hw, hh, look.skin);
  c.stroke(hx, hy, hw, hh, ink);
  c.clear(hx, hy); c.clear(hx + hw - 1, hy);
  c.clear(hx, hy + hh - 1); c.clear(hx + hw - 1, hy + hh - 1);

  // ---- cabelo ----
  if (back) {
    c.rect(hx, hy, hw, 11, look.hair);
    c.stroke(hx, hy, hw, 11, ink);
    c.clear(hx, hy); c.clear(hx + hw - 1, hy);
  } else if (side) {
    // de perfil: franja na frente, nuca coberta
    c.rect(hx, hy, hw, 5, look.hair);
    c.rect(hx + hw - 4, hy, 4, 9, look.hair);   // nuca (lado de trás)
    c.rect(hx, hy + 4, 3, 2, look.hair);        // franja caindo
    c.stroke(hx, hy, hw, 5, ink);
  } else {
    c.rect(hx, hy, hw, 5, look.hair);
    c.rect(hx, hy, 3, 8, look.hair);
    c.rect(hx + hw - 3, hy, 3, 8, look.hair);
    for (let x = 2; x < hw - 2; x++) c.px(hx + x, hy + 5, noise(x, 1) > 0.55 ? look.hair : ink);
  }

  // ---- rosto ----
  const ey = hy + 7;
  if (dir === 0) {
    c.rect(hx + 3, ey, 2, 2, ink);
    c.rect(hx + 9, ey, 2, 2, ink);
    c.px(hx + 6, ey + 3, '#C98C80');
    c.px(hx + 7, ey + 3, '#C98C80');
  } else if (side) {
    c.rect(hx + 2, ey, 2, 2, ink);              // olho único, perto da frente
    c.px(hx - 1, ey + 1, look.skin);            // nariz saindo do contorno
    c.px(hx - 1, ey, ink);
    c.px(hx + 1, ey + 4, '#C98C80');            // boca
  }
}

function buildCharacters() {
  const cols = LOOKS.length * 3; // 3 frames por visual
  const c = new Canvas(cols * CW, 4 * CH);
  LOOKS.forEach((look, v) => {
    for (let dir = 0; dir < 4; dir++) {
      for (let f = 0; f < 3; f++) {
        let cell = new Canvas(CW, CH);
        drawChar(cell, look, dir === 2 ? 1 : dir, f);
        if (dir === 2) cell = mirror(cell); // direita = espelho da esquerda
        c.blit(cell, (v * 3 + f) * CW, dir * CH);
      }
    }
  });
  return c;
}

// ---------- escrita ----------
mkdirSync(`${OUT}/tilesets`, { recursive: true });
mkdirSync(`${OUT}/characters`, { recursive: true });

const ts = buildTileset();
writeFileSync(`${OUT}/tilesets/office.png`, ts.toPNG());
console.log(`[pixelart] tileset  ${ts.width}x${ts.height}  (8 tiles de ${T}px)`);

const ch = buildCharacters();
writeFileSync(`${OUT}/characters/people.png`, ch.toPNG());
console.log(`[pixelart] personagens ${ch.width}x${ch.height}  (${LOOKS.length} visuais x 4 direcoes x 3 frames de ${CW}x${CH})`);

writeFileSync(
  `${OUT}/characters/people.json`,
  JSON.stringify({ frameWidth: CW, frameHeight: CH, looks: LOOKS.length, framesPerDir: 3 }, null, 2),
);
