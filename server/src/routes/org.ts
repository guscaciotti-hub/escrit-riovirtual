import { Router } from 'express';
import {
  DESKS,
  MAP_HEIGHT_TILES,
  MAP_WIDTH_TILES,
  MEETING_SEATS,
  PLAYER_SPAWN,
  TILE_SIZE,
} from '@evoluze/shared';
import { getCurrentOrg, getCurrentUser } from '../middleware/auth.js';
import { listAgents, listRooms } from '../db/repo.js';
import { hasApiKey } from '../services/anthropic.js';

export const orgRouter = Router();

/** Bootstrap do cliente: usuário, org, agentes, salas e layout lógico do mapa. */
orgRouter.get('/bootstrap', (req, res) => {
  const user = getCurrentUser(req);
  const org = getCurrentOrg(req);
  res.json({
    user,
    org,
    agents: listAgents(org.id, true),
    rooms: listRooms(org.id),
    map: {
      tileSize: TILE_SIZE,
      widthTiles: MAP_WIDTH_TILES,
      heightTiles: MAP_HEIGHT_TILES,
      playerSpawn: PLAYER_SPAWN,
      desks: DESKS,
      meetingSeats: MEETING_SEATS,
      tmjUrl: '/assets/maps/office.tmj',
    },
    features: {
      llmEnabled: hasApiKey(),
    },
  });
});
