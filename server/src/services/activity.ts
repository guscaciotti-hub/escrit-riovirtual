import { and, desc, eq, gte, lte, sql as dsql } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import {
  ACTIVITY_POLICY_VERSION,
  ACTIVITY_RETENTION_DAYS,
  IDLE_THRESHOLD_SECONDS,
  TILE_SIZE,
  WEB_CATEGORIES,
  type ActivityConsent,
  type ActivityScope,
  type ActivitySummary,
  type DailyActivity,
  type ExtensionBatch,
  type RoomBounds,
  type WebCategory,
} from '@evoluze/shared';
import { db } from '../db/index.js';
import {
  activityConsents,
  activityDaily,
  activityEvents,
  activitySessions,
  rooms,
  users,
} from '../db/schema.js';

/**
 * Serviço de atividade / produtividade.
 *
 * O que este módulo NUNCA faz: guardar URL, título de página, screenshot ou
 * conteúdo de mensagem. Ele lida só com duração por sala e por categoria.
 */

const nowIso = () => new Date().toISOString();
const dayOf = (iso: string) => iso.slice(0, 10);

// ---------------- Consentimento ----------------

/** Aceite da versão atual da política. É a prova registrada do aviso. */
export function acceptConsent(orgId: string, userId: string, scope: ActivityScope) {
  db.insert(activityConsents)
    .values({
      id: `csn_${nanoid(10)}`,
      orgId,
      userId,
      policyVersion: ACTIVITY_POLICY_VERSION,
      scope,
    })
    .run();
}

export function revokeConsent(orgId: string, userId: string, scope: ActivityScope) {
  db.update(activityConsents)
    .set({ revokedAt: nowIso() })
    .where(
      and(
        eq(activityConsents.orgId, orgId),
        eq(activityConsents.userId, userId),
        eq(activityConsents.scope, scope),
      ),
    )
    .run();
  if (scope === 'office') closeOpenEvents(userId);
}

export function getConsents(orgId: string, userId: string): ActivityConsent[] {
  const scopes: ActivityScope[] = ['office', 'extension'];
  return scopes.map((scope) => {
    const row = db
      .select()
      .from(activityConsents)
      .where(
        and(
          eq(activityConsents.orgId, orgId),
          eq(activityConsents.userId, userId),
          eq(activityConsents.scope, scope),
        ),
      )
      .orderBy(desc(activityConsents.acceptedAt))
      .get();
    const active = row && !row.revokedAt;
    return {
      scope,
      policyVersion: row?.policyVersion ?? '',
      acceptedAt: row?.acceptedAt ?? null,
      revokedAt: row?.revokedAt ?? null,
      current: !!active && row!.policyVersion === ACTIVITY_POLICY_VERSION,
    };
  });
}

export function hasConsent(orgId: string, userId: string, scope: ActivityScope): boolean {
  return getConsents(orgId, userId).some((c) => c.scope === scope && c.current);
}

// ---------------- Sessão + rastreio de sala ----------------

interface LiveState {
  sessionId: string;
  roomId: string | null;
  since: number;
  lastMove: number;
  paused: boolean;
}

const live = new Map<string, LiveState>();

export function startSession(orgId: string, userId: string, source: ActivityScope = 'office'): string | null {
  if (!hasConsent(orgId, userId, scopeForSource(source))) return null;
  const id = `ses_${nanoid(10)}`;
  db.insert(activitySessions).values({ id, orgId, userId, source }).run();
  live.set(userId, { sessionId: id, roomId: null, since: Date.now(), lastMove: Date.now(), paused: false });
  return id;
}

function scopeForSource(source: ActivityScope): ActivityScope {
  return source;
}

export function setPaused(userId: string, paused: boolean) {
  const st = live.get(userId);
  if (!st) return;
  if (paused) flushCurrent(userId);
  st.paused = paused;
  st.since = Date.now();
  db.update(activitySessions).set({ paused }).where(eq(activitySessions.id, st.sessionId)).run();
}

export function isPaused(userId: string): boolean {
  return live.get(userId)?.paused ?? false;
}

/** Cache de bounds das salas (em tiles) por org. */
const roomCache = new Map<string, Array<{ id: string; type: string; bounds: RoomBounds }>>();

function roomsOf(orgId: string) {
  if (!roomCache.has(orgId)) {
    const rows = db.select().from(rooms).where(eq(rooms.orgId, orgId)).all();
    roomCache.set(
      orgId,
      rows.map((r) => ({
        id: r.id,
        type: r.type,
        bounds: JSON.parse(r.bounds) as RoomBounds,
      })),
    );
  }
  return roomCache.get(orgId)!;
}

/** Qual sala contém a posição (px)? */
export function roomAt(orgId: string, x: number, y: number): { id: string; type: string } | null {
  const tx = Math.floor(x / TILE_SIZE);
  const ty = Math.floor(y / TILE_SIZE);
  for (const r of roomsOf(orgId)) {
    const b = r.bounds;
    if (tx >= b.x && tx < b.x + b.w && ty >= b.y && ty < b.y + b.h) return { id: r.id, type: r.type };
  }
  return null;
}

/**
 * Chamado a cada movimento. Fecha o intervalo da sala anterior e abre o novo.
 * Guarda duração por sala — nunca a trajetória (não é GPS de funcionário).
 */
export function trackPosition(orgId: string, userId: string, x: number, y: number) {
  const st = live.get(userId);
  if (!st || st.paused) return;
  st.lastMove = Date.now();
  const room = roomAt(orgId, x, y);
  const roomId = room?.id ?? null;
  if (roomId === st.roomId) return;
  writeInterval(orgId, userId, st, 'room', { roomId: st.roomId });
  st.roomId = roomId;
  st.since = Date.now();
}

function writeInterval(
  orgId: string,
  userId: string,
  st: LiveState,
  kind: 'room' | 'idle' | 'meeting' | 'paused',
  extra: { roomId?: string | null; meetingId?: string | null } = {},
) {
  const seconds = Math.round((Date.now() - st.since) / 1000);
  if (seconds < 2) return;
  const startedAt = new Date(st.since).toISOString();
  const idleFor = (Date.now() - st.lastMove) / 1000;
  const effectiveKind = kind === 'room' && idleFor > IDLE_THRESHOLD_SECONDS ? 'idle' : kind;
  db.insert(activityEvents)
    .values({
      id: `evt_${nanoid(12)}`,
      orgId,
      userId,
      sessionId: st.sessionId,
      kind: effectiveKind,
      roomId: extra.roomId ?? null,
      meetingId: extra.meetingId ?? null,
      startedAt,
      endedAt: nowIso(),
      durationSeconds: seconds,
    })
    .run();
  rollupDay(orgId, userId, dayOf(startedAt));
}

function flushCurrent(userId: string) {
  const st = live.get(userId);
  if (!st) return;
  const row = db.select().from(activitySessions).where(eq(activitySessions.id, st.sessionId)).get();
  if (row) writeInterval(row.orgId, userId, st, 'room', { roomId: st.roomId });
}

export function heartbeat(userId: string) {
  const st = live.get(userId);
  if (!st) return;
  db.update(activitySessions).set({ lastSeenAt: nowIso() }).where(eq(activitySessions.id, st.sessionId)).run();
}

export function endSession(userId: string) {
  const st = live.get(userId);
  if (!st) return;
  flushCurrent(userId);
  db.update(activitySessions)
    .set({ endedAt: nowIso() })
    .where(eq(activitySessions.id, st.sessionId))
    .run();
  live.delete(userId);
}

function closeOpenEvents(userId: string) {
  flushCurrent(userId);
  live.delete(userId);
}

/** Participação em reunião conta como tempo de reunião, não de foco. */
export function trackMeeting(orgId: string, userId: string, meetingId: string, seconds: number) {
  if (!hasConsent(orgId, userId, 'office') || isPaused(userId)) return;
  const startedAt = new Date(Date.now() - seconds * 1000).toISOString();
  db.insert(activityEvents)
    .values({
      id: `evt_${nanoid(12)}`,
      orgId,
      userId,
      sessionId: live.get(userId)?.sessionId ?? null,
      kind: 'meeting',
      meetingId,
      startedAt,
      endedAt: nowIso(),
      durationSeconds: seconds,
    })
    .run();
  rollupDay(orgId, userId, dayOf(startedAt));
}

// ---------------- Extensão ----------------

/** Lote da extensão: só categoria + segundos. Rejeita qualquer coisa a mais. */
export function ingestExtensionBatch(orgId: string, userId: string, batch: ExtensionBatch) {
  if (!hasConsent(orgId, userId, 'extension')) {
    throw new Error('Sem consentimento ativo para a extensão.');
  }
  const valid = new Set(WEB_CATEGORIES.map((c) => c.id));
  const date = batch.date.slice(0, 10);
  for (const entry of batch.entries) {
    if (!valid.has(entry.category)) continue;
    const seconds = Math.max(0, Math.min(86400, Math.round(entry.seconds)));
    if (seconds === 0) continue;
    db.insert(activityEvents)
      .values({
        id: `evt_${nanoid(12)}`,
        orgId,
        userId,
        sessionId: null,
        kind: 'web',
        category: entry.category,
        startedAt: `${date}T00:00:00.000Z`,
        endedAt: `${date}T23:59:59.000Z`,
        durationSeconds: seconds,
      })
      .run();
  }
  if (batch.idleSeconds > 0) {
    db.insert(activityEvents)
      .values({
        id: `evt_${nanoid(12)}`,
        orgId,
        userId,
        kind: 'idle',
        startedAt: `${date}T00:00:00.000Z`,
        durationSeconds: Math.round(batch.idleSeconds),
      })
      .run();
  }
  rollupDay(orgId, userId, date);
}

// ---------------- Agregação ----------------

/** Recalcula o agregado do dia a partir dos eventos brutos. Idempotente. */
export function rollupDay(orgId: string, userId: string, date: string) {
  const evts = db
    .select()
    .from(activityEvents)
    .where(
      and(
        eq(activityEvents.orgId, orgId),
        eq(activityEvents.userId, userId),
        gte(activityEvents.startedAt, `${date}T00:00:00.000Z`),
        lte(activityEvents.startedAt, `${date}T23:59:59.999Z`),
      ),
    )
    .all();

  const roomTypes = new Map(roomsOf(orgId).map((r) => [r.id, r.type]));
  let focus = 0;
  let meeting = 0;
  let lounge = 0;
  let idle = 0;
  const web: Record<string, number> = {};
  const meetingIds = new Set<string>();

  for (const e of evts) {
    const d = e.durationSeconds;
    if (e.kind === 'idle') idle += d;
    else if (e.kind === 'meeting') {
      meeting += d;
      if (e.meetingId) meetingIds.add(e.meetingId);
    } else if (e.kind === 'web') {
      if (e.category) web[e.category] = (web[e.category] ?? 0) + d;
    } else if (e.kind === 'room') {
      const t = e.roomId ? roomTypes.get(e.roomId) : undefined;
      if (t === 'meeting') meeting += d;
      else if (t === 'lounge') lounge += d;
      else focus += d;
    }
  }

  const office = focus + meeting + lounge + idle;
  const id = `dly_${userId}_${date}`;
  db.insert(activityDaily)
    .values({
      id,
      orgId,
      userId,
      date,
      secondsOffice: office,
      secondsFocus: focus,
      secondsMeeting: meeting,
      secondsLounge: lounge,
      secondsIdle: idle,
      meetingsCount: meetingIds.size,
      interventionsCount: 0,
      webCategories: JSON.stringify(web),
      updatedAt: nowIso(),
    })
    .onConflictDoUpdate({
      target: activityDaily.id,
      set: {
        secondsOffice: office,
        secondsFocus: focus,
        secondsMeeting: meeting,
        secondsLounge: lounge,
        secondsIdle: idle,
        meetingsCount: meetingIds.size,
        webCategories: JSON.stringify(web),
        updatedAt: nowIso(),
      },
    })
    .run();
}

/** Resumo por período. userId nulo = todos da org (visão do gestor). */
export function summary(orgId: string, from: string, to: string, userId?: string): ActivitySummary {
  const conds = [
    eq(activityDaily.orgId, orgId),
    gte(activityDaily.date, from),
    lte(activityDaily.date, to),
  ];
  if (userId) conds.push(eq(activityDaily.userId, userId));
  const rows = db
    .select()
    .from(activityDaily)
    .where(and(...conds))
    .orderBy(activityDaily.date)
    .all();

  const names = new Map(
    db.select().from(users).where(eq(users.orgId, orgId)).all().map((u) => [u.id, u.name]),
  );
  const productive = new Set(WEB_CATEGORIES.filter((c) => c.productive).map((c) => c.id));

  const days: DailyActivity[] = rows.map((r) => ({
    date: r.date,
    userId: r.userId,
    userName: names.get(r.userId) ?? r.userId,
    secondsOffice: r.secondsOffice,
    secondsFocus: r.secondsFocus,
    secondsMeeting: r.secondsMeeting,
    secondsLounge: r.secondsLounge,
    secondsIdle: r.secondsIdle,
    meetingsCount: r.meetingsCount,
    interventionsCount: r.interventionsCount,
    webCategories: JSON.parse(r.webCategories) as Partial<Record<WebCategory, number>>,
  }));

  const totals = days.reduce(
    (acc, d) => {
      acc.secondsOffice += d.secondsOffice;
      acc.secondsFocus += d.secondsFocus;
      acc.secondsMeeting += d.secondsMeeting;
      acc.secondsIdle += d.secondsIdle;
      acc.meetingsCount += d.meetingsCount;
      for (const [cat, sec] of Object.entries(d.webCategories)) {
        if (productive.has(cat as WebCategory)) acc.secondsProductiveWeb += sec ?? 0;
        else acc.secondsUnproductiveWeb += sec ?? 0;
      }
      return acc;
    },
    {
      secondsOffice: 0,
      secondsFocus: 0,
      secondsMeeting: 0,
      secondsIdle: 0,
      secondsProductiveWeb: 0,
      secondsUnproductiveWeb: 0,
      meetingsCount: 0,
    },
  );

  return { from, to, days, totals };
}

// ---------------- LGPD: retenção, exportação, exclusão ----------------

/** Apaga eventos brutos além da janela de retenção. O agregado permanece. */
export function purgeExpiredEvents(): number {
  const cutoff = new Date(Date.now() - ACTIVITY_RETENTION_DAYS * 86400_000).toISOString();
  const res = db.delete(activityEvents).where(lte(activityEvents.startedAt, cutoff)).run();
  return res.changes;
}

/** Portabilidade: tudo que o sistema sabe sobre a pessoa. */
export function exportUserData(orgId: string, userId: string) {
  return {
    exportedAt: nowIso(),
    policyVersion: ACTIVITY_POLICY_VERSION,
    consents: getConsents(orgId, userId),
    sessions: db
      .select()
      .from(activitySessions)
      .where(and(eq(activitySessions.orgId, orgId), eq(activitySessions.userId, userId)))
      .all(),
    events: db
      .select()
      .from(activityEvents)
      .where(and(eq(activityEvents.orgId, orgId), eq(activityEvents.userId, userId)))
      .all(),
    daily: db
      .select()
      .from(activityDaily)
      .where(and(eq(activityDaily.orgId, orgId), eq(activityDaily.userId, userId)))
      .all(),
  };
}

/** Direito à eliminação. Remove tudo de atividade da pessoa. */
export function deleteUserData(orgId: string, userId: string) {
  db.delete(activityEvents)
    .where(and(eq(activityEvents.orgId, orgId), eq(activityEvents.userId, userId)))
    .run();
  db.delete(activityDaily)
    .where(and(eq(activityDaily.orgId, orgId), eq(activityDaily.userId, userId)))
    .run();
  db.delete(activitySessions)
    .where(and(eq(activitySessions.orgId, orgId), eq(activitySessions.userId, userId)))
    .run();
  live.delete(userId);
}
