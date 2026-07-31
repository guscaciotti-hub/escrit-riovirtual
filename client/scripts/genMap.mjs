/**
 * Gera client/public/assets/maps/office.tmj a partir do layout canônico.
 *
 * Estes valores ESPELHAM shared/src/mapLayout.ts (mantidos em sincronia à mão —
 * o script roda em node puro, sem loader de TS). Se mudar um, mude o outro.
 *
 * O mapa é um Tiled Map (.tmj) ortogonal 32x32. As tiles são placeholders
 * lógicos (GIDs por tipo) renderizados como retângulos coloridos pela OfficeScene.
 * Para trocar pelo pack real (LimeZu/Kenney), basta adicionar o tileset PNG e
 * apontar o tileset no .tmj — o resto do pipeline (colisão, camadas) não muda.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(__dirname, '../public/assets/maps/office.tmj');

const TILE = 32;
const W = 34;
const H = 24;

const ROOMS = [
  { id: 'room_open', name: 'Open Space', type: 'open_space', bounds: { x: 1, y: 1, w: 21, h: 13 } },
  { id: 'room_meeting', name: 'Sala de Reunião', type: 'meeting', bounds: { x: 23, y: 1, w: 10, h: 10 } },
  { id: 'room_lounge', name: 'Lounge / Café', type: 'lounge', bounds: { x: 1, y: 15, w: 13, h: 8 } },
  { id: 'room_ceo', name: 'Sala do CEO', type: 'private', bounds: { x: 23, y: 12, w: 10, h: 11 } },
];
const DESKS = [
  { id: 'desk_left', x: 5, y: 6 },
  { id: 'desk_center', x: 11, y: 6 },
  { id: 'desk_right', x: 17, y: 6 },
];
const MEETING_TABLE = [
  { x: 27, y: 4 }, { x: 28, y: 4 }, { x: 29, y: 4 },
  { x: 27, y: 5 }, { x: 28, y: 5 }, { x: 29, y: 5 },
];
const MEETING_SEATS = [
  { x: 27, y: 3 }, { x: 28, y: 3 }, { x: 29, y: 3 },
  { x: 27, y: 6 }, { x: 28, y: 6 }, { x: 29, y: 6 },
  { x: 26, y: 4 }, { x: 30, y: 4 },
];
const PLAYER_SPAWN = { x: 27, y: 17 };
const PLANTS = [
  { x: 2, y: 2 }, { x: 20, y: 2 }, { x: 2, y: 21 }, { x: 32, y: 21 }, { x: 24, y: 2 },
];
const WALL_SEGMENTS = [
  { from: { x: 0, y: 0 }, to: { x: W - 1, y: 0 } },
  { from: { x: 0, y: H - 1 }, to: { x: W - 1, y: H - 1 } },
  { from: { x: 0, y: 0 }, to: { x: 0, y: H - 1 } },
  { from: { x: W - 1, y: 0 }, to: { x: W - 1, y: H - 1 } },
  { from: { x: 22, y: 1 }, to: { x: 22, y: H - 2 }, doors: [{ x: 22, y: 6 }, { x: 22, y: 17 }] },
  { from: { x: 1, y: 14 }, to: { x: 21, y: 14 }, doors: [{ x: 6, y: 14 }] },
  { from: { x: 23, y: 11 }, to: { x: W - 2, y: 11 }, doors: [{ x: 27, y: 11 }] },
];

// GIDs lógicos
const FLOOR = 1;
const FLOOR_LOUNGE = 6;
const FLOOR_CEO = 7;
const FLOOR_MEETING = 8;
const WALL = 2;
const DESK = 3;
const TABLE = 4;
const PLANT = 5;

const idx = (x, y) => y * W + x;
const empty = () => new Array(W * H).fill(0);

const floor = empty();
const walls = empty();
const furniture = empty();
const furnitureTop = empty();

// Piso por sala
for (const r of ROOMS) {
  const g = r.type === 'lounge' ? FLOOR_LOUNGE : r.type === 'private' ? FLOOR_CEO : r.type === 'meeting' ? FLOOR_MEETING : FLOOR;
  for (let y = r.bounds.y; y < r.bounds.y + r.bounds.h; y++) {
    for (let x = r.bounds.x; x < r.bounds.x + r.bounds.w; x++) {
      floor[idx(x, y)] = g;
    }
  }
}

// Paredes (com portas)
for (const seg of WALL_SEGMENTS) {
  const doors = new Set((seg.doors ?? []).map((d) => `${d.x},${d.y}`));
  const dx = Math.sign(seg.to.x - seg.from.x);
  const dy = Math.sign(seg.to.y - seg.from.y);
  let { x, y } = seg.from;
  while (true) {
    if (!doors.has(`${x},${y}`)) {
      walls[idx(x, y)] = WALL;
      floor[idx(x, y)] = 0; // parede não tem piso por baixo (visual)
    }
    if (x === seg.to.x && y === seg.to.y) break;
    x += dx;
    y += dy;
  }
}

// Móveis com colisão
for (const d of DESKS) furniture[idx(d.x, d.y)] = DESK;
for (const t of MEETING_TABLE) furniture[idx(t.x, t.y)] = TABLE;
// Plantas acima do player (sem colisão de topo)
for (const p of PLANTS) furnitureTop[idx(p.x, p.y)] = PLANT;

function tileLayer(name, data) {
  return {
    data,
    height: H,
    width: W,
    id: 0,
    name,
    opacity: 1,
    type: 'tilelayer',
    visible: true,
    x: 0,
    y: 0,
  };
}

// Object layer 'zones' com salas (retângulos) + pontos lógicos.
const objects = [];
let oid = 1;
for (const r of ROOMS) {
  objects.push({
    id: oid++,
    name: r.name,
    type: r.type,
    x: r.bounds.x * TILE,
    y: r.bounds.y * TILE,
    width: r.bounds.w * TILE,
    height: r.bounds.h * TILE,
    visible: true,
    rotation: 0,
    properties: [{ name: 'roomId', type: 'string', value: r.id }],
  });
}
const point = (name, t, extraProps = []) => ({
  id: oid++,
  name,
  point: true,
  x: t.x * TILE + TILE / 2,
  y: t.y * TILE + TILE / 2,
  width: 0,
  height: 0,
  visible: true,
  rotation: 0,
  properties: extraProps,
});
for (const d of DESKS) objects.push(point(d.id, d, [{ name: 'kind', type: 'string', value: 'desk' }]));
MEETING_SEATS.forEach((s, i) => objects.push(point(`seat_${i + 1}`, s, [{ name: 'kind', type: 'string', value: 'seat' }])));
objects.push(point('player_spawn', PLAYER_SPAWN, [{ name: 'kind', type: 'string', value: 'spawn' }]));

const map = {
  compressionlevel: -1,
  width: W,
  height: H,
  tilewidth: TILE,
  tileheight: TILE,
  infinite: false,
  orientation: 'orthogonal',
  renderorder: 'right-down',
  type: 'map',
  version: '1.10',
  tiledversion: '1.10.2',
  nextlayerid: 6,
  nextobjectid: oid,
  // Tileset placeholder: a OfficeScene desenha retângulos por GID (ver colorForGid).
  // Para usar o pack real, troque por um tileset com "image".
  tilesets: [
    {
      firstgid: 1,
      name: 'placeholder',
      tilewidth: TILE,
      tileheight: TILE,
      tilecount: 8,
      columns: 8,
      grid: { orientation: 'orthogonal', width: TILE, height: TILE },
    },
  ],
  layers: [
    tileLayer('floor', floor),
    tileLayer('walls', walls),
    tileLayer('furniture', furniture),
    tileLayer('furniture_top', furnitureTop),
    {
      id: 5,
      name: 'zones',
      type: 'objectgroup',
      draworder: 'topdown',
      opacity: 1,
      visible: true,
      x: 0,
      y: 0,
      objects,
    },
  ],
};

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, JSON.stringify(map, null, 1));
console.log(`[genMap] escrito ${OUT} (${W}x${H} tiles)`);
