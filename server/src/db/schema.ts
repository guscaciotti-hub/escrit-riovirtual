import { sql } from 'drizzle-orm';
import { integer, sqliteTable, text, real, index } from 'drizzle-orm/sqlite-core';

/**
 * Schema multi-tenant desde o dia 1.
 * Toda entidade de negócio carrega `org_id`. JSONs são armazenados como TEXT
 * e (de)serializados na camada de repositório. Timestamps em ISO-8601 (TEXT)
 * para portabilidade direta ao Postgres depois (basta trocar o driver).
 */

const now = sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`;

export const orgs = sqliteTable('orgs', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  createdAt: text('created_at').notNull().default(now),
});

export const users = sqliteTable(
  'users',
  {
    id: text('id').primaryKey(),
    orgId: text('org_id')
      .notNull()
      .references(() => orgs.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    email: text('email').notNull(),
    role: text('role', { enum: ['master', 'member'] })
      .notNull()
      .default('member'),
    avatarConfig: text('avatar_config').notNull().default('{}'),
    createdAt: text('created_at').notNull().default(now),
  },
  (t) => ({
    orgIdx: index('users_org_idx').on(t.orgId),
  }),
);

export const agents = sqliteTable(
  'agents',
  {
    id: text('id').primaryKey(),
    orgId: text('org_id')
      .notNull()
      .references(() => orgs.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    jobTitle: text('job_title').notNull(),
    department: text('department').notNull(),
    avatarConfig: text('avatar_config').notNull().default('{}'),
    spawnX: integer('spawn_x').notNull().default(0),
    spawnY: integer('spawn_y').notNull().default(0),
    deskId: text('desk_id'),
    personaSystemPrompt: text('persona_system_prompt').notNull(),
    personalityTraits: text('personality_traits').notNull().default('{}'),
    knowledgeScope: text('knowledge_scope').notNull().default(''),
    model: text('model', { enum: ['claude-sonnet-4-6', 'claude-haiku-4-5'] })
      .notNull()
      .default('claude-sonnet-4-6'),
    isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
    createdAt: text('created_at').notNull().default(now),
  },
  (t) => ({
    orgIdx: index('agents_org_idx').on(t.orgId),
  }),
);

export const agentMemory = sqliteTable(
  'agent_memory',
  {
    id: text('id').primaryKey(),
    agentId: text('agent_id')
      .notNull()
      .references(() => agents.id, { onDelete: 'cascade' }),
    meetingId: text('meeting_id'),
    type: text('type', {
      enum: ['decision', 'insight', 'commitment', 'context'],
    }).notNull(),
    content: text('content').notNull(),
    importance: integer('importance').notNull().default(3),
    createdAt: text('created_at').notNull().default(now),
  },
  (t) => ({
    agentIdx: index('agent_memory_agent_idx').on(t.agentId),
  }),
);

export const rooms = sqliteTable(
  'rooms',
  {
    id: text('id').primaryKey(),
    orgId: text('org_id')
      .notNull()
      .references(() => orgs.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    type: text('type', {
      enum: ['open_space', 'meeting', 'lounge', 'private'],
    }).notNull(),
    bounds: text('bounds').notNull().default('{}'),
    capacity: integer('capacity').notNull().default(8),
  },
  (t) => ({
    orgIdx: index('rooms_org_idx').on(t.orgId),
  }),
);

export const meetings = sqliteTable(
  'meetings',
  {
    id: text('id').primaryKey(),
    orgId: text('org_id')
      .notNull()
      .references(() => orgs.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    agenda: text('agenda').notNull(),
    roomId: text('room_id').notNull(),
    mode: text('mode', { enum: ['debate', 'brainstorm', 'decisao'] })
      .notNull()
      .default('debate'),
    durationMinutes: integer('duration_minutes'),
    maxRounds: integer('max_rounds').notNull().default(6),
    maxTokens: integer('max_tokens').notNull().default(60000),
    status: text('status', { enum: ['scheduled', 'running', 'finished'] })
      .notNull()
      .default('scheduled'),
    startedAt: text('started_at'),
    finishedAt: text('finished_at'),
    tokenCostEstimate: integer('token_cost_estimate').notNull().default(0),
    tokenCostActual: integer('token_cost_actual').notNull().default(0),
    createdAt: text('created_at').notNull().default(now),
  },
  (t) => ({
    orgIdx: index('meetings_org_idx').on(t.orgId),
  }),
);

export const meetingParticipants = sqliteTable(
  'meeting_participants',
  {
    id: text('id').primaryKey(),
    meetingId: text('meeting_id')
      .notNull()
      .references(() => meetings.id, { onDelete: 'cascade' }),
    agentId: text('agent_id'),
    userId: text('user_id'),
  },
  (t) => ({
    meetingIdx: index('meeting_participants_meeting_idx').on(t.meetingId),
  }),
);

export const meetingMessages = sqliteTable(
  'meeting_messages',
  {
    id: text('id').primaryKey(),
    meetingId: text('meeting_id')
      .notNull()
      .references(() => meetings.id, { onDelete: 'cascade' }),
    speakerType: text('speaker_type', {
      enum: ['agent', 'user', 'system'],
    }).notNull(),
    speakerId: text('speaker_id'),
    speakerName: text('speaker_name').notNull().default(''),
    roundNumber: integer('round_number').notNull().default(0),
    content: text('content').notNull(),
    tokensIn: integer('tokens_in').notNull().default(0),
    tokensOut: integer('tokens_out').notNull().default(0),
    createdAt: text('created_at').notNull().default(now),
  },
  (t) => ({
    meetingIdx: index('meeting_messages_meeting_idx').on(t.meetingId),
  }),
);

export const meetingMinutes = sqliteTable('meeting_minutes', {
  id: text('id').primaryKey(),
  meetingId: text('meeting_id')
    .notNull()
    .references(() => meetings.id, { onDelete: 'cascade' }),
  summary: text('summary').notNull().default(''),
  decisions: text('decisions').notNull().default('[]'),
  actionItems: text('action_items').notNull().default('[]'),
  openQuestions: text('open_questions').notNull().default('[]'),
  createdAt: text('created_at').notNull().default(now),
});

export type OrgRow = typeof orgs.$inferSelect;
export type UserRow = typeof users.$inferSelect;
export type AgentRow = typeof agents.$inferSelect;
export type AgentMemoryRow = typeof agentMemory.$inferSelect;
export type RoomRow = typeof rooms.$inferSelect;
export type MeetingRow = typeof meetings.$inferSelect;
export type MeetingParticipantRow = typeof meetingParticipants.$inferSelect;
export type MeetingMessageRow = typeof meetingMessages.$inferSelect;
export type MeetingMinutesRow = typeof meetingMinutes.$inferSelect;

// ============================================================
// Produtividade / atividade (LGPD-aware)
// Princípios: nunca guardamos conteúdo (sem screenshot, sem keylog, sem URL
// crua). A extensão categoriza NA MÁQUINA do usuário e envia só
// {categoria, segundos}. Evento bruto tem retenção curta; o que persiste
// é o agregado diário.
// ============================================================

/** Aceite da política de monitoramento, versionado. Prova de que houve aviso. */
export const activityConsents = sqliteTable(
  'activity_consents',
  {
    id: text('id').primaryKey(),
    orgId: text('org_id')
      .notNull()
      .references(() => orgs.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    policyVersion: text('policy_version').notNull(),
    /** o que foi aceito: escritório e/ou extensão de navegador */
    scope: text('scope', { enum: ['office', 'extension'] }).notNull(),
    acceptedAt: text('accepted_at').notNull().default(now),
    revokedAt: text('revoked_at'),
  },
  (t) => ({
    userIdx: index('activity_consents_user_idx').on(t.userId),
  }),
);

/** Uma sessão de trabalho (login no escritório ou extensão ativa). */
export const activitySessions = sqliteTable(
  'activity_sessions',
  {
    id: text('id').primaryKey(),
    orgId: text('org_id')
      .notNull()
      .references(() => orgs.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    source: text('source', { enum: ['office', 'extension'] }).notNull(),
    startedAt: text('started_at').notNull().default(now),
    lastSeenAt: text('last_seen_at').notNull().default(now),
    endedAt: text('ended_at'),
    /** usuário pausou o rastreamento nesta sessão */
    paused: integer('paused', { mode: 'boolean' }).notNull().default(false),
  },
  (t) => ({
    userIdx: index('activity_sessions_user_idx').on(t.userId),
  }),
);

/**
 * Evento de atividade. Retenção curta (ver ACTIVITY_RETENTION_DAYS).
 * `kind='web'` usa `category` (nunca URL). Os demais usam roomId/meetingId.
 */
export const activityEvents = sqliteTable(
  'activity_events',
  {
    id: text('id').primaryKey(),
    orgId: text('org_id')
      .notNull()
      .references(() => orgs.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    sessionId: text('session_id'),
    kind: text('kind', { enum: ['room', 'meeting', 'idle', 'web', 'paused'] }).notNull(),
    roomId: text('room_id'),
    meetingId: text('meeting_id'),
    /** categoria de uso da web, resolvida no cliente. Nunca a URL. */
    category: text('category'),
    startedAt: text('started_at').notNull(),
    endedAt: text('ended_at'),
    durationSeconds: integer('duration_seconds').notNull().default(0),
    createdAt: text('created_at').notNull().default(now),
  },
  (t) => ({
    userDayIdx: index('activity_events_user_idx').on(t.userId, t.startedAt),
  }),
);

/** Agregado diário — é o que sobrevive à limpeza dos eventos brutos. */
export const activityDaily = sqliteTable(
  'activity_daily',
  {
    id: text('id').primaryKey(),
    orgId: text('org_id')
      .notNull()
      .references(() => orgs.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    /** YYYY-MM-DD */
    date: text('date').notNull(),
    secondsOffice: integer('seconds_office').notNull().default(0),
    secondsFocus: integer('seconds_focus').notNull().default(0),
    secondsMeeting: integer('seconds_meeting').notNull().default(0),
    secondsLounge: integer('seconds_lounge').notNull().default(0),
    secondsIdle: integer('seconds_idle').notNull().default(0),
    meetingsCount: integer('meetings_count').notNull().default(0),
    interventionsCount: integer('interventions_count').notNull().default(0),
    /** JSON: { categoria: segundos } vindo da extensão */
    webCategories: text('web_categories').notNull().default('{}'),
    updatedAt: text('updated_at').notNull().default(now),
  },
  (t) => ({
    userDateIdx: index('activity_daily_user_date_idx').on(t.userId, t.date),
  }),
);

/** Token de pareamento da extensão (guardamos só o hash). */
export const extensionTokens = sqliteTable(
  'extension_tokens',
  {
    id: text('id').primaryKey(),
    orgId: text('org_id')
      .notNull()
      .references(() => orgs.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    tokenHash: text('token_hash').notNull(),
    label: text('label').notNull().default(''),
    createdAt: text('created_at').notNull().default(now),
    lastUsedAt: text('last_used_at'),
    revokedAt: text('revoked_at'),
  },
  (t) => ({
    hashIdx: index('extension_tokens_hash_idx').on(t.tokenHash),
  }),
);

export type ActivityConsentRow = typeof activityConsents.$inferSelect;
export type ActivitySessionRow = typeof activitySessions.$inferSelect;
export type ActivityEventRow = typeof activityEvents.$inferSelect;
export type ActivityDailyRow = typeof activityDaily.$inferSelect;
export type ExtensionTokenRow = typeof extensionTokens.$inferSelect;
