import type {
  Agent,
  AgentMemory,
  Meeting,
  MeetingMessage,
  MeetingMinutes,
  Org,
  Room,
  User,
} from '@evoluze/shared';
import type {
  AgentMemoryRow,
  AgentRow,
  MeetingMessageRow,
  MeetingMinutesRow,
  MeetingRow,
  OrgRow,
  RoomRow,
  UserRow,
} from './schema.js';

function json<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export const toOrg = (r: OrgRow): Org => ({
  id: r.id,
  name: r.name,
  slug: r.slug,
  createdAt: r.createdAt,
});

export const toUser = (r: UserRow): User => ({
  id: r.id,
  orgId: r.orgId,
  name: r.name,
  email: r.email,
  role: r.role,
  avatarConfig: json(r.avatarConfig, { sprite: 'default' }),
  createdAt: r.createdAt,
});

export const toAgent = (r: AgentRow): Agent => ({
  id: r.id,
  orgId: r.orgId,
  name: r.name,
  jobTitle: r.jobTitle,
  department: r.department,
  avatarConfig: json(r.avatarConfig, { sprite: 'default' }),
  spawnX: r.spawnX,
  spawnY: r.spawnY,
  deskId: r.deskId,
  personaSystemPrompt: r.personaSystemPrompt,
  personalityTraits: json(r.personalityTraits, {}),
  knowledgeScope: r.knowledgeScope,
  model: r.model,
  isActive: r.isActive,
  createdAt: r.createdAt,
});

export const toAgentMemory = (r: AgentMemoryRow): AgentMemory => ({
  id: r.id,
  agentId: r.agentId,
  meetingId: r.meetingId,
  type: r.type,
  content: r.content,
  importance: r.importance,
  createdAt: r.createdAt,
});

export const toRoom = (r: RoomRow): Room => ({
  id: r.id,
  orgId: r.orgId,
  name: r.name,
  type: r.type,
  bounds: json(r.bounds, { x: 0, y: 0, w: 0, h: 0 }),
  capacity: r.capacity,
});

export const toMeeting = (r: MeetingRow): Meeting => ({
  id: r.id,
  orgId: r.orgId,
  title: r.title,
  agenda: r.agenda,
  roomId: r.roomId,
  mode: r.mode,
  durationMinutes: r.durationMinutes,
  maxRounds: r.maxRounds,
  maxTokens: r.maxTokens,
  status: r.status,
  startedAt: r.startedAt,
  finishedAt: r.finishedAt,
  tokenCostEstimate: r.tokenCostEstimate,
  tokenCostActual: r.tokenCostActual,
  createdAt: r.createdAt,
});

export const toMeetingMessage = (r: MeetingMessageRow): MeetingMessage => ({
  id: r.id,
  meetingId: r.meetingId,
  speakerType: r.speakerType,
  speakerId: r.speakerId,
  speakerName: r.speakerName,
  roundNumber: r.roundNumber,
  content: r.content,
  tokensIn: r.tokensIn,
  tokensOut: r.tokensOut,
  createdAt: r.createdAt,
});

export const toMeetingMinutes = (r: MeetingMinutesRow): MeetingMinutes => ({
  id: r.id,
  meetingId: r.meetingId,
  summary: r.summary,
  decisions: json(r.decisions, []),
  actionItems: json(r.actionItems, []),
  openQuestions: json(r.openQuestions, []),
  createdAt: r.createdAt,
});
