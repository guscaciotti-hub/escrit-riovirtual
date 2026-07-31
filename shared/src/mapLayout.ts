/**
 * Layout canônico do escritório em unidades de TILE.
 * Fonte única de verdade para:
 *   - o gerador do office.tmj (client/scripts/genMap.mjs)
 *   - o seed do banco (rooms, desks, spawns dos agentes)
 *   - o cliente (posições de assento em reunião, spawn do player)
 *
 * O cliente RENDERIZA o mapa a partir do office.tmj (arquivo Tiled), mas as
 * coordenadas lógicas (assentos, mesas, spawn) vêm daqui para não haver drift.
 */

export const TILE_SIZE = 32;
export const MAP_WIDTH_TILES = 34;
export const MAP_HEIGHT_TILES = 24;
export const MAP_WIDTH_PX = MAP_WIDTH_TILES * TILE_SIZE;
export const MAP_HEIGHT_PX = MAP_HEIGHT_TILES * TILE_SIZE;

export interface TileRect {
  x: number;
  y: number;
  w: number;
  h: number;
}
export interface TilePoint {
  x: number;
  y: number;
}

export type RoomKind = 'open_space' | 'meeting' | 'lounge' | 'private';

export interface RoomLayout {
  id: string;
  name: string;
  type: RoomKind;
  /** área INTERNA de piso (tiles) — não inclui as paredes */
  bounds: TileRect;
}

export const ROOMS: RoomLayout[] = [
  { id: 'room_open', name: 'Open Space', type: 'open_space', bounds: { x: 1, y: 1, w: 21, h: 13 } },
  { id: 'room_meeting', name: 'Sala de Reunião', type: 'meeting', bounds: { x: 23, y: 1, w: 10, h: 10 } },
  { id: 'room_lounge', name: 'Lounge / Café', type: 'lounge', bounds: { x: 1, y: 15, w: 13, h: 8 } },
  { id: 'room_ceo', name: 'Sala do CEO', type: 'private', bounds: { x: 23, y: 12, w: 10, h: 11 } },
];

/** Mesas dos agentes no open space (o agente fica NESTE tile). */
export interface DeskLayout {
  id: string;
  tile: TilePoint;
}
export const DESKS: DeskLayout[] = [
  { id: 'desk_left', tile: { x: 5, y: 6 } },
  { id: 'desk_center', tile: { x: 11, y: 6 } },
  { id: 'desk_right', tile: { x: 17, y: 6 } },
];

/** Mesa central da sala de reunião (tiles ocupados pelo móvel — colisão). */
export const MEETING_TABLE: TilePoint[] = [
  { x: 27, y: 4 }, { x: 28, y: 4 }, { x: 29, y: 4 },
  { x: 27, y: 5 }, { x: 28, y: 5 }, { x: 29, y: 5 },
];

/** Assentos em volta da mesa de reunião (onde os agentes sentam). */
export const MEETING_SEATS: TilePoint[] = [
  { x: 27, y: 3 }, { x: 28, y: 3 }, { x: 29, y: 3 }, // topo
  { x: 27, y: 6 }, { x: 28, y: 6 }, { x: 29, y: 6 }, // base
  { x: 26, y: 4 }, { x: 30, y: 4 },                   // laterais
];

/** Spawn do player (CEO) na sala do CEO. */
export const PLAYER_SPAWN: TilePoint = { x: 27, y: 17 };

/**
 * Segmentos de parede (colisão). Cada segmento é uma reta horizontal ou
 * vertical em tiles, com furos (doorways) opcionais.
 */
export interface WallSegment {
  from: TilePoint;
  to: TilePoint;
  /** tiles a remover (portas) ao longo do segmento */
  doors?: TilePoint[];
}

export const WALL_SEGMENTS: WallSegment[] = [
  // Perímetro do prédio
  { from: { x: 0, y: 0 }, to: { x: MAP_WIDTH_TILES - 1, y: 0 } },
  { from: { x: 0, y: MAP_HEIGHT_TILES - 1 }, to: { x: MAP_WIDTH_TILES - 1, y: MAP_HEIGHT_TILES - 1 } },
  { from: { x: 0, y: 0 }, to: { x: 0, y: MAP_HEIGHT_TILES - 1 } },
  { from: { x: MAP_WIDTH_TILES - 1, y: 0 }, to: { x: MAP_WIDTH_TILES - 1, y: MAP_HEIGHT_TILES - 1 } },
  // Divisória vertical (open space | meeting+ceo), coluna 22, portas p/ reunião e ceo
  { from: { x: 22, y: 1 }, to: { x: 22, y: MAP_HEIGHT_TILES - 2 }, doors: [{ x: 22, y: 6 }, { x: 22, y: 17 }] },
  // Divisória horizontal (open space | lounge), linha 14, porta no col 6
  { from: { x: 1, y: 14 }, to: { x: 21, y: 14 }, doors: [{ x: 6, y: 14 }] },
  // Divisória horizontal (meeting | ceo), linha 11, porta no col 27
  { from: { x: 23, y: 11 }, to: { x: MAP_WIDTH_TILES - 2, y: 11 }, doors: [{ x: 27, y: 11 }] },
];

/** Plantas/decoração (furniture_top — renderiza acima do player, sem colisão de topo). */
export const PLANTS: TilePoint[] = [
  { x: 2, y: 2 }, { x: 20, y: 2 }, { x: 2, y: 21 }, { x: 32, y: 21 }, { x: 24, y: 2 },
];

export const MEETING_ROOM_ID = 'room_meeting';

/** Converte tile -> centro em pixels. */
export function tileToPx(t: TilePoint): { x: number; y: number } {
  return { x: t.x * TILE_SIZE + TILE_SIZE / 2, y: t.y * TILE_SIZE + TILE_SIZE / 2 };
}
