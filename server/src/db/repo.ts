import { and, asc, desc, eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import type {
  Agent,
  AgentMemory,
  AgentMemoryType,
  CreateAgentInput,
  CreateMeetingInput,
  Meeting,
  MeetingMessage,
  MeetingMinutes,
  Room,
  SpeakerType,
  UpdateAgentInput,
} from '@evoluze/shared';
import { db } from './index.js';
import {
  agentMemory,
  agents,
  meetingMessages,
  meetingMinutes,
  meetingParticipants,
  meetings,
  rooms,
} from './schema.js';
import {
  toAgent,
  toAgentMemory,
  toMeeting,
  toMeetingMessage,
  toMeetingMinutes,
  toRoom,
} from './mappers.js';

/**
 * Repositório org-scoped. TODA leitura/escrita de negócio passa o orgId.
 * É a fronteira que garante isolamento multi-tenant.
 */

// ---------- Agentes ----------

export function listAgents(orgId: string, onlyActive = false): Agent[] {
  const rows = db
    .select()
    .from(agents)
    .where(eq(agents.orgId, orgId))
    .orderBy(asc(agents.createdAt))
    .all();
  const mapped = rows.map(toAgent);
  return onlyActive ? mapped.filter((a) => a.isActive) : mapped;
}

export function getAgent(orgId: string, id: string): Agent | null {
  const row = db
    .select()
    .from(agents)
    .where(and(eq(agents.orgId, orgId), eq(agents.id, id)))
    .get();
  return row ? toAgent(row) : null;
}

export function createAgent(orgId: string, input: CreateAgentInput): Agent {
  const id = `agent_${nanoid(10)}`;
  db.insert(agents)
    .values({
      id,
      orgId,
      name: input.name,
      jobTitle: input.jobTitle,
      department: input.department,
      avatarConfig: JSON.stringify(input.avatarConfig ?? { sprite: 'default', tint: '#888888' }),
      spawnX: input.spawnX,
      spawnY: input.spawnY,
      deskId: input.deskId ?? null,
      personaSystemPrompt: input.personaSystemPrompt,
      personalityTraits: JSON.stringify(input.personalityTraits ?? {}),
      knowledgeScope: input.knowledgeScope,
      model: input.model ?? 'claude-sonnet-4-6',
      isActive: true,
    })
    .run();
  return getAgent(orgId, id)!;
}

export function updateAgent(orgId: string, id: string, input: UpdateAgentInput): Agent | null {
  const existing = getAgent(orgId, id);
  if (!existing) return null;
  const patch: Record<string, unknown> = {};
  if (input.name !== undefined) patch.name = input.name;
  if (input.jobTitle !== undefined) patch.jobTitle = input.jobTitle;
  if (input.department !== undefined) patch.department = input.department;
  if (input.avatarConfig !== undefined) patch.avatarConfig = JSON.stringify(input.avatarConfig);
  if (input.spawnX !== undefined) patch.spawnX = input.spawnX;
  if (input.spawnY !== undefined) patch.spawnY = input.spawnY;
  if (input.deskId !== undefined) patch.deskId = input.deskId;
  if (input.personaSystemPrompt !== undefined) patch.personaSystemPrompt = input.personaSystemPrompt;
  if (input.personalityTraits !== undefined)
    patch.personalityTraits = JSON.stringify(input.personalityTraits);
  if (input.knowledgeScope !== undefined) patch.knowledgeScope = input.knowledgeScope;
  if (input.model !== undefined) patch.model = input.model;
  if (input.isActive !== undefined) patch.isActive = input.isActive;
  if (Object.keys(patch).length > 0) {
    db.update(agents).set(patch).where(and(eq(agents.orgId, orgId), eq(agents.id, id))).run();
  }
  return getAgent(orgId, id);
}

export function deleteAgent(orgId: string, id: string): boolean {
  const res = db.delete(agents).where(and(eq(agents.orgId, orgId), eq(agents.id, id))).run();
  return res.changes > 0;
}

// ---------- Salas ----------

export function listRooms(orgId: string): Room[] {
  return db.select().from(rooms).where(eq(rooms.orgId, orgId)).all().map(toRoom);
}

export function getRoom(orgId: string, id: string): Room | null {
  const row = db
    .select()
    .from(rooms)
    .where(and(eq(rooms.orgId, orgId), eq(rooms.id, id)))
    .get();
  return row ? toRoom(row) : null;
}

// ---------- Memória de agente ----------

export function addMemory(
  agentId: string,
  meetingId: string | null,
  type: AgentMemoryType,
  content: string,
  importance: number,
): AgentMemory {
  const id = `mem_${nanoid(10)}`;
  db.insert(agentMemory)
    .values({ id, agentId, meetingId, type, content, importance })
    .run();
  return toAgentMemory(db.select().from(agentMemory).where(eq(agentMemory.id, id)).get()!);
}

/** Top-N memórias por importância (para injetar no contexto). */
export function topMemories(agentId: string, limit = 8): AgentMemory[] {
  return db
    .select()
    .from(agentMemory)
    .where(eq(agentMemory.agentId, agentId))
    .orderBy(desc(agentMemory.importance), desc(agentMemory.createdAt))
    .limit(limit)
    .all()
    .map(toAgentMemory);
}

// ---------- Reuniões ----------

export function createMeeting(
  orgId: string,
  input: CreateMeetingInput,
  roomId: string,
  estimateTokens: number,
): Meeting {
  const id = `meet_${nanoid(10)}`;
  db.insert(meetings)
    .values({
      id,
      orgId,
      title: input.title,
      agenda: input.agenda,
      roomId,
      mode: input.mode,
      durationMinutes: input.durationMinutes ?? null,
      maxRounds: input.maxRounds,
      maxTokens: input.maxTokens ?? 60000,
      status: 'scheduled',
      tokenCostEstimate: estimateTokens,
    })
    .run();
  for (const agentId of input.agentIds) {
    db.insert(meetingParticipants)
      .values({ id: `mp_${nanoid(10)}`, meetingId: id, agentId, userId: null })
      .run();
  }
  return getMeeting(orgId, id)!;
}

export function getMeeting(orgId: string, id: string): Meeting | null {
  const row = db
    .select()
    .from(meetings)
    .where(and(eq(meetings.orgId, orgId), eq(meetings.id, id)))
    .get();
  return row ? toMeeting(row) : null;
}

export function listMeetings(orgId: string): Meeting[] {
  return db
    .select()
    .from(meetings)
    .where(eq(meetings.orgId, orgId))
    .orderBy(desc(meetings.createdAt))
    .all()
    .map(toMeeting);
}

export function meetingParticipantAgentIds(meetingId: string): string[] {
  return db
    .select()
    .from(meetingParticipants)
    .where(eq(meetingParticipants.meetingId, meetingId))
    .all()
    .map((r) => r.agentId)
    .filter((x): x is string => !!x);
}

export function setMeetingStatus(
  id: string,
  status: 'scheduled' | 'running' | 'finished',
  extra: Partial<{ startedAt: string; finishedAt: string; tokenCostActual: number }> = {},
) {
  db.update(meetings).set({ status, ...extra }).where(eq(meetings.id, id)).run();
}

export function bumpMeetingCost(id: string, tokenCostActual: number) {
  db.update(meetings).set({ tokenCostActual }).where(eq(meetings.id, id)).run();
}

export function addMeetingMessage(
  meetingId: string,
  speakerType: SpeakerType,
  speakerId: string | null,
  speakerName: string,
  roundNumber: number,
  content: string,
  tokensIn = 0,
  tokensOut = 0,
): MeetingMessage {
  const id = `msg_${nanoid(12)}`;
  db.insert(meetingMessages)
    .values({ id, meetingId, speakerType, speakerId, speakerName, roundNumber, content, tokensIn, tokensOut })
    .run();
  return toMeetingMessage(db.select().from(meetingMessages).where(eq(meetingMessages.id, id)).get()!);
}

export function listMeetingMessages(meetingId: string): MeetingMessage[] {
  return db
    .select()
    .from(meetingMessages)
    .where(eq(meetingMessages.meetingId, meetingId))
    .orderBy(asc(meetingMessages.createdAt))
    .all()
    .map(toMeetingMessage);
}

export function saveMinutes(
  meetingId: string,
  data: Omit<MeetingMinutes, 'id' | 'meetingId' | 'createdAt'>,
): MeetingMinutes {
  const id = `min_${nanoid(10)}`;
  db.insert(meetingMinutes)
    .values({
      id,
      meetingId,
      summary: data.summary,
      decisions: JSON.stringify(data.decisions),
      actionItems: JSON.stringify(data.actionItems),
      openQuestions: JSON.stringify(data.openQuestions),
    })
    .run();
  return toMeetingMinutes(db.select().from(meetingMinutes).where(eq(meetingMinutes.id, id)).get()!);
}

export function getMinutes(meetingId: string): MeetingMinutes | null {
  const row = db.select().from(meetingMinutes).where(eq(meetingMinutes.meetingId, meetingId)).get();
  return row ? toMeetingMinutes(row) : null;
}
