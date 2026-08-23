/**
 * Tipos compartilhados entre client e server.
 * Fonte única de verdade para os contratos de dados que trafegam via REST e Socket.io.
 */

export * from './mapLayout.js';
export * from './minutesFormat.js';

// ============================================================
// Domínio: Organização / Usuário (multi-tenant desde o dia 1)
// ============================================================

export type UserRole = 'master' | 'member';

export interface AvatarConfig {
  /** id do spritesheet do personagem em /public/assets/characters */
  sprite: string;
  /** cor de destaque usada em placeholders e no balão de nome */
  tint?: string;
}

export interface Org {
  id: string;
  name: string;
  slug: string;
  createdAt: string;
}

export interface User {
  id: string;
  orgId: string;
  name: string;
  email: string;
  role: UserRole;
  avatarConfig: AvatarConfig;
  createdAt: string;
}

// ============================================================
// Domínio: Agentes
// ============================================================

export type AgentModel = 'claude-sonnet-4-6' | 'claude-haiku-4-5';

/** Traços de personalidade. Chaves livres, valores 0..10. */
export type PersonalityTraits = Record<string, number>;

export interface Agent {
  id: string;
  orgId: string;
  name: string;
  jobTitle: string;
  department: string;
  avatarConfig: AvatarConfig;
  spawnX: number;
  spawnY: number;
  deskId: string | null;
  personaSystemPrompt: string;
  personalityTraits: PersonalityTraits;
  knowledgeScope: string;
  model: AgentModel;
  isActive: boolean;
  createdAt: string;
}

/** Payload de criação de agente (Fase 4 — CRUD completo via API). */
export interface CreateAgentInput {
  name: string;
  jobTitle: string;
  department: string;
  avatarConfig?: AvatarConfig;
  spawnX: number;
  spawnY: number;
  deskId?: string | null;
  personaSystemPrompt: string;
  personalityTraits?: PersonalityTraits;
  knowledgeScope: string;
  model?: AgentModel;
}

export type UpdateAgentInput = Partial<CreateAgentInput> & { isActive?: boolean };

export type AgentMemoryType = 'decision' | 'insight' | 'commitment' | 'context';

export interface AgentMemory {
  id: string;
  agentId: string;
  meetingId: string | null;
  type: AgentMemoryType;
  content: string;
  importance: number; // 1..5
  createdAt: string;
}

// ============================================================
// Domínio: Salas / Mapa
// ============================================================

export type RoomType = 'open_space' | 'meeting' | 'lounge' | 'private';

export interface RoomBounds {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Room {
  id: string;
  orgId: string;
  name: string;
  type: RoomType;
  bounds: RoomBounds;
  capacity: number;
}

// ============================================================
// Domínio: Reuniões
// ============================================================

export type MeetingMode = 'debate' | 'brainstorm' | 'decisao';
export type MeetingStatus = 'scheduled' | 'running' | 'finished';

export interface Meeting {
  id: string;
  orgId: string;
  title: string;
  agenda: string;
  roomId: string;
  mode: MeetingMode;
  durationMinutes: number | null;
  maxRounds: number;
  maxTokens: number;
  status: MeetingStatus;
  startedAt: string | null;
  finishedAt: string | null;
  tokenCostEstimate: number;
  tokenCostActual: number;
  createdAt: string;
}

export interface CreateMeetingInput {
  title: string;
  agenda: string;
  roomId?: string;
  mode: MeetingMode;
  agentIds: string[];
  maxRounds: number;
  durationMinutes?: number | null;
  maxTokens?: number;
}

export type SpeakerType = 'agent' | 'user' | 'system';

export interface MeetingMessage {
  id: string;
  meetingId: string;
  speakerType: SpeakerType;
  speakerId: string | null;
  speakerName: string;
  roundNumber: number;
  content: string;
  tokensIn: number;
  tokensOut: number;
  createdAt: string;
}

export interface ActionItem {
  task: string;
  owner: string; // nome do agente responsável
  ownerAgentId: string | null;
  dueSuggestion: string;
}

export interface Decision {
  decision: string;
  rationale: string;
}

export interface MeetingMinutes {
  id: string;
  meetingId: string;
  summary: string;
  decisions: Decision[];
  actionItems: ActionItem[];
  openQuestions: string[];
  createdAt: string;
}

// ============================================================
// Estimativa e custo de tokens
// ============================================================

export interface TokenEstimate {
  rounds: number;
  participants: number;
  avgTokensPerTurn: number;
  estimatedTurns: number;
  estimatedTokens: number;
  estimatedCostUsd: number;
}

export interface TokenUsageUpdate {
  meetingId: string;
  tokensIn: number;
  tokensOut: number;
  cumulativeTokens: number;
  cumulativeCostUsd: number;
}

// ============================================================
// Chat 1:1 (proximidade)
// ============================================================

export interface DirectChatMessage {
  role: 'user' | 'assistant';
  content: string;
  tokensIn?: number;
  tokensOut?: number;
  createdAt: string;
}

// ============================================================
// Realtime: presença e movimentação (pronto para multiplayer)
// ============================================================

export type Facing = 'up' | 'down' | 'left' | 'right';

export interface EntityState {
  id: string;
  kind: 'user' | 'agent';
  name: string;
  x: number;
  y: number;
  facing: Facing;
  moving: boolean;
  status?: string; // emoji ou label de status
}

// ============================================================
// Contratos de eventos Socket.io (tipados)
// ============================================================

/** Onde cada agente deve sentar na sala de reunião (tile). */
export interface SeatAssignment {
  agentId: string;
  x: number; // tile x
  y: number; // tile y
}

/** Eventos emitidos pelo servidor para os clientes. */
export interface ServerToClientEvents {
  'presence:sync': (entities: EntityState[]) => void;
  'presence:update': (entity: EntityState) => void;
  'presence:leave': (id: string) => void;

  /** Reunião convocada: agentes devem caminhar até seus assentos. */
  'meeting:convened': (payload: { meeting: Meeting; seats: SeatAssignment[] }) => void;
  'meeting:started': (payload: { meetingId: string }) => void;
  'meeting:message': (message: MeetingMessage) => void;
  'meeting:thinking': (payload: { meetingId: string; agentId: string; agentName: string }) => void;
  'meeting:round': (payload: { meetingId: string; round: number; totalRounds: number }) => void;
  'meeting:usage': (usage: TokenUsageUpdate) => void;
  'meeting:minutes': (minutes: MeetingMinutes) => void;
  'meeting:finished': (payload: { meetingId: string }) => void;
  'meeting:error': (payload: { meetingId: string; error: string }) => void;
}

/** Eventos emitidos pelos clientes para o servidor. */
export interface ClientToServerEvents {
  'presence:join': (payload: { userId: string }) => void;
  'presence:move': (payload: { x: number; y: number; facing: Facing; moving: boolean }) => void;

  'meeting:convene': (payload: CreateMeetingInput, ack: (res: { meetingId?: string; error?: string }) => void) => void;
  'meeting:ready': (payload: { meetingId: string }) => void;
  'meeting:intervene': (payload: { meetingId: string; content: string }) => void;
  'meeting:stop': (payload: { meetingId: string }) => void;
}

// ============================================================
// Preços de modelo (USD por 1M tokens) — para estimativa de custo
// ============================================================

export interface ModelPricing {
  inputPerMTok: number;
  outputPerMTok: number;
}

export const MODEL_PRICING: Record<AgentModel, ModelPricing> = {
  'claude-sonnet-4-6': { inputPerMTok: 3, outputPerMTok: 15 },
  'claude-haiku-4-5': { inputPerMTok: 1, outputPerMTok: 5 },
};

export const DEFAULT_MODELS = {
  debate: 'claude-haiku-4-5' as AgentModel,
  reasoning: 'claude-sonnet-4-6' as AgentModel,
};

export * from './activity.js';
