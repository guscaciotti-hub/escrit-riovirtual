/** Cores dos placeholders por GID lógico do tileset (ver genMap.mjs). */
export const TILE_COLORS: Record<number, number> = {
  1: 0x16233a, // floor open space
  2: 0x2b3d63, // wall
  3: 0x5b4636, // desk (colisão)
  4: 0x4a3a28, // meeting table (colisão)
  5: 0x1f7a4d, // plant (furniture_top)
  6: 0x1a2b26, // floor lounge
  7: 0x241a2e, // floor ceo
  8: 0x123030, // floor meeting
};

/** GIDs que geram colisão (walls + furniture com corpo). */
export const COLLIDING_GIDS = new Set([2, 3, 4]);

export const PROXIMITY_RADIUS_TILES = 2;

export const CHARACTER = {
  bodyW: 22,
  bodyH: 26,
  speed: 150, // px/s
};

export const DEPTH = {
  floor: 0,
  walls: 1,
  furniture: 2,
  entitiesBase: 10, // + y para ordenação top-down
  furnitureTop: 20000,
  namePill: 30000,
  bubble: 31000,
};
