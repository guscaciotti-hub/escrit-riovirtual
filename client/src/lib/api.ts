import {
  DESKS,
  MAP_HEIGHT_TILES,
  MAP_WIDTH_TILES,
  MEETING_SEATS,
  PLAYER_SPAWN,
  TILE_SIZE,
  tileToPx,
  type Agent,
  type CreateAgentInput,
  type MeetingMinutes,
  type Room,
  type TokenEstimate,
  type User,
} from '@evoluze/shared';

export const SERVER_URL = import.meta.env.VITE_SERVER_URL ?? 'http://localhost:3001';

export interface MapConfig {
  tileSize: number;
  widthTiles: number;
  heightTiles: number;
  playerSpawn: { x: number; y: number };
  desks: Array<{ id: string; tile: { x: number; y: number } }>;
  meetingSeats: Array<{ x: number; y: number }>;
  tmjUrl: string;
}

export interface Bootstrap {
  user: User;
  org: Org;
  agents: Agent[];
  rooms: Room[];
  map: MapConfig;
  features: { llmEnabled: boolean };
  online: boolean;
}

interface Org {
  id: string;
  name: string;
  slug: string;
  createdAt: string;
}

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${SERVER_URL}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ? JSON.stringify(body.error) : `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

/**
 * Bootstrap do app. Tenta o backend; se offline, cai para um fallback local
 * (mapa + 3 agentes do seed) para que o escritório seja explorável mesmo sem
 * servidor — chat 1:1 e reuniões ficam desativados (precisam do backend + chave).
 */
export async function fetchBootstrap(): Promise<Bootstrap> {
  try {
    const data = await req<Omit<Bootstrap, 'online'>>('/api/bootstrap');
    return { ...data, online: true };
  } catch {
    return { ...offlineBootstrap(), online: false };
  }
}

function offlineBootstrap(): Omit<Bootstrap, 'online'> {
  const iso = '1970-01-01T00:00:00Z';
  const org: Org = { id: 'org_evoluze', name: 'Evoluze Marketing', slug: 'evoluze', createdAt: iso };
  const user: User = {
    id: 'user_gustavo',
    orgId: org.id,
    name: 'Gustavo Scaciotti',
    email: 'gustavopaidtraffic@gmail.com',
    role: 'master',
    avatarConfig: { sprite: 'ceo', tint: '#00D4C6' },
    createdAt: iso,
  };
  const stub = (
    id: string,
    name: string,
    jobTitle: string,
    department: string,
    tint: string,
    desk: string,
    tile: { x: number; y: number },
    traits: Record<string, number>,
  ): Agent => {
    const px = tileToPx(tile);
    return {
      id,
      orgId: org.id,
      name,
      jobTitle,
      department,
      avatarConfig: { sprite: id, tint },
      spawnX: px.x,
      spawnY: px.y,
      deskId: desk,
      personaSystemPrompt: '',
      personalityTraits: traits,
      knowledgeScope: '',
      model: 'claude-sonnet-4-6',
      isActive: true,
      createdAt: iso,
    };
  };
  const agents: Agent[] = [
    stub('agent_ricardo', 'Ricardo Antunes', 'Diretor Comercial (CRO)', 'Vendas', '#E4572E', 'desk_left', DESKS[0].tile, {
      assertividade: 9, criatividade: 6, cautela: 3, foco_receita: 10, paciencia: 4,
    }),
    stub('agent_camila', 'Camila Reis', 'Diretora de Performance & Mídia', 'Tráfego / Operações', '#00D4C6', 'desk_center', DESKS[1].tile, {
      assertividade: 7, criatividade: 8, cautela: 7, rigor_analitico: 10, paciencia: 8,
    }),
    stub('agent_teo', 'Téo Vasconcelos', 'Head de Produto & Growth (SaaS)', 'Produto', '#7B61FF', 'desk_right', DESKS[2].tile, {
      assertividade: 6, criatividade: 10, cautela: 5, visao_longo_prazo: 9, paciencia: 6,
    }),
  ];
  const rooms: Room[] = [];
  return {
    user,
    org,
    agents,
    rooms,
    map: {
      tileSize: TILE_SIZE,
      widthTiles: MAP_WIDTH_TILES,
      heightTiles: MAP_HEIGHT_TILES,
      playerSpawn: PLAYER_SPAWN,
      desks: DESKS,
      meetingSeats: MEETING_SEATS,
      // respeita o base do build (GitHub Pages serve em subdiretório)
      tmjUrl: `${import.meta.env.BASE_URL}assets/maps/office.tmj`,
    },
    features: { llmEnabled: false },
  };
}

// ---- Agentes (CRUD) ----
export const listAgents = () => req<Agent[]>('/api/agents');
export const createAgent = (input: CreateAgentInput) =>
  req<Agent>('/api/agents', { method: 'POST', body: JSON.stringify(input) });

// ---- Reuniões ----
export const estimateMeeting = (rounds: number, participants: number) =>
  req<TokenEstimate>('/api/meetings/estimate', {
    method: 'POST',
    body: JSON.stringify({ rounds, participants }),
  });

export function minutesExportUrl(meetingId: string) {
  return `${SERVER_URL}/api/meetings/${meetingId}/export.md`;
}

// ---- Chat 1:1 ----
export interface ChatReply {
  reply: string;
  tokensIn: number;
  tokensOut: number;
  costUsd: number;
}
export const sendChat = (agentId: string, message: string, history: Array<{ role: 'user' | 'assistant'; content: string }>) =>
  req<ChatReply>(`/api/chat/${agentId}`, {
    method: 'POST',
    body: JSON.stringify({ message, history }),
  });

export type { MeetingMinutes };
