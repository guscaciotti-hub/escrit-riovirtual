import { Router, type Request, type Response, type NextFunction } from 'express';
import crypto from 'node:crypto';
import { z } from 'zod';
import { and, eq, isNull } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import {
  ACTIVITY_POLICY_VERSION,
  ACTIVITY_RETENTION_DAYS,
  DOMAIN_CATEGORIES,
  WEB_CATEGORIES,
} from '@evoluze/shared';
import { getCurrentOrg, getCurrentUser } from '../middleware/auth.js';
import { db } from '../db/index.js';
import { extensionTokens, users } from '../db/schema.js';
import * as activity from '../services/activity.js';

export const activityRouter = Router();

const hash = (t: string) => crypto.createHash('sha256').update(t).digest('hex');

/** Só o gestor (master) enxerga dados de terceiros. */
function requireMaster(req: Request, res: Response, next: NextFunction) {
  if (getCurrentUser(req).role !== 'master') {
    res.status(403).json({ error: 'Apenas o gestor tem acesso a este painel.' });
    return;
  }
  next();
}

// ---------------- Política e consentimento ----------------

/** Texto da política — é o que a pessoa vê e aceita. Versionado. */
activityRouter.get('/policy', (_req, res) => {
  res.json({
    version: ACTIVITY_POLICY_VERSION,
    retentionDays: ACTIVITY_RETENTION_DAYS,
    categories: WEB_CATEGORIES,
    collected: [
      'Tempo conectado ao escritório virtual e tempo em cada sala (foco, reunião, lounge).',
      'Reuniões das quais você participou e por quanto tempo.',
      'Se a extensão estiver instalada: tempo por CATEGORIA de site (ex.: "Mídia paga", "Comunicação").',
    ],
    notCollected: [
      'O endereço (URL) dos sites que você visita — a classificação acontece no seu computador e só a categoria é enviada.',
      'Capturas de tela, teclas digitadas ou conteúdo de mensagens.',
      'Qualquer atividade enquanto o rastreamento estiver pausado.',
      'Sua localização física.',
    ],
    rights: [
      'Pausar o rastreamento a qualquer momento pelo botão no topo da tela.',
      'Exportar tudo o que foi coletado sobre você, em JSON.',
      'Solicitar a exclusão dos seus dados de atividade.',
      `Dados brutos são apagados após ${ACTIVITY_RETENTION_DAYS} dias; ficam apenas totais diários.`,
    ],
    visibility:
      'O painel com os relatórios é acessível apenas ao gestor da organização. Você pode exportar os seus próprios dados a qualquer momento.',
  });
});

activityRouter.get('/consent', (req, res) => {
  const org = getCurrentOrg(req);
  const user = getCurrentUser(req);
  res.json(activity.getConsents(org.id, user.id));
});

const consentSchema = z.object({ scope: z.enum(['office', 'extension']) });

activityRouter.post('/consent', (req, res) => {
  const parsed = consentSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const org = getCurrentOrg(req);
  const user = getCurrentUser(req);
  activity.acceptConsent(org.id, user.id, parsed.data.scope);
  if (parsed.data.scope === 'office') activity.startSession(org.id, user.id, 'office');
  res.status(201).json(activity.getConsents(org.id, user.id));
});

activityRouter.delete('/consent/:scope', (req, res) => {
  const parsed = consentSchema.safeParse({ scope: req.params.scope });
  if (!parsed.success) return res.status(400).json({ error: 'escopo inválido' });
  const org = getCurrentOrg(req);
  const user = getCurrentUser(req);
  activity.revokeConsent(org.id, user.id, parsed.data.scope);
  res.json(activity.getConsents(org.id, user.id));
});

// ---------------- Pausa ----------------

activityRouter.post('/pause', (req, res) => {
  const paused = z.object({ paused: z.boolean() }).safeParse(req.body);
  if (!paused.success) return res.status(400).json({ error: 'payload inválido' });
  const user = getCurrentUser(req);
  activity.setPaused(user.id, paused.data.paused);
  res.json({ paused: activity.isPaused(user.id) });
});

activityRouter.get('/pause', (req, res) => {
  res.json({ paused: activity.isPaused(getCurrentUser(req).id) });
});

// ---------------- Painel (somente gestor) ----------------

activityRouter.get('/summary', requireMaster, (req, res) => {
  const org = getCurrentOrg(req);
  const to = (req.query.to as string) ?? new Date().toISOString().slice(0, 10);
  const from =
    (req.query.from as string) ??
    new Date(Date.now() - 13 * 86400_000).toISOString().slice(0, 10);
  const userId = (req.query.userId as string) || undefined;
  res.json(activity.summary(org.id, from, to, userId));
});

/** Pessoas monitoráveis + estado de consentimento (visão do gestor). */
activityRouter.get('/people', requireMaster, (req, res) => {
  const org = getCurrentOrg(req);
  const rows = db.select().from(users).where(eq(users.orgId, org.id)).all();
  res.json(
    rows.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role,
      consents: activity.getConsents(org.id, u.id),
    })),
  );
});

// ---------------- Direitos do titular (qualquer pessoa, sobre si) ----------------

activityRouter.get('/me/export', (req, res) => {
  const org = getCurrentOrg(req);
  const user = getCurrentUser(req);
  const data = activity.exportUserData(org.id, user.id);
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="meus-dados-${user.id}.json"`);
  res.send(JSON.stringify(data, null, 2));
});

activityRouter.delete('/me', (req, res) => {
  const org = getCurrentOrg(req);
  const user = getCurrentUser(req);
  activity.deleteUserData(org.id, user.id);
  res.status(204).end();
});

// ---------------- Extensão: pareamento e ingestão ----------------

/** Gera token de pareamento. Mostrado UMA vez; guardamos só o hash. */
activityRouter.post('/extension/token', (req, res) => {
  const org = getCurrentOrg(req);
  const user = getCurrentUser(req);
  if (!activity.hasConsent(org.id, user.id, 'extension')) {
    return res.status(403).json({ error: 'Aceite a política da extensão antes de parear.' });
  }
  const token = `evx_${nanoid(32)}`;
  db.insert(extensionTokens)
    .values({
      id: `ext_${nanoid(10)}`,
      orgId: org.id,
      userId: user.id,
      tokenHash: hash(token),
      label: (req.body?.label as string) ?? 'Navegador',
    })
    .run();
  res.status(201).json({ token, serverUrl: `${req.protocol}://${req.get('host')}` });
});

activityRouter.get('/extension/tokens', (req, res) => {
  const org = getCurrentOrg(req);
  const user = getCurrentUser(req);
  const rows = db
    .select()
    .from(extensionTokens)
    .where(and(eq(extensionTokens.orgId, org.id), eq(extensionTokens.userId, user.id)))
    .all();
  res.json(rows.map(({ tokenHash, ...rest }) => rest));
});

activityRouter.delete('/extension/token/:id', (req, res) => {
  const org = getCurrentOrg(req);
  const user = getCurrentUser(req);
  db.update(extensionTokens)
    .set({ revokedAt: new Date().toISOString() })
    .where(
      and(
        eq(extensionTokens.orgId, org.id),
        eq(extensionTokens.userId, user.id),
        eq(extensionTokens.id, req.params.id),
      ),
    )
    .run();
  res.status(204).end();
});

const batchSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  entries: z
    .array(
      z.object({
        category: z.enum(WEB_CATEGORIES.map((c) => c.id) as [string, ...string[]]),
        seconds: z.number().min(0).max(86400),
      }),
    )
    .max(50),
  idleSeconds: z.number().min(0).max(86400).default(0),
});

/**
 * Ingestão da extensão. Autenticada por token próprio (não pela sessão do app).
 * `.strict()` no schema garante que qualquer campo extra (uma URL, por exemplo)
 * faça a requisição falhar em vez de ser gravado por acidente.
 */
export const extensionIngestRouter = Router();

/**
 * Mapa de domínios que a extensão usa para classificar LOCALMENTE.
 * Serve o mapa para o cliente; a resolução URL->categoria nunca acontece aqui.
 */
extensionIngestRouter.get('/categories', (_req, res) => {
  res.json({ domains: DOMAIN_CATEGORIES, categories: WEB_CATEGORIES });
});

extensionIngestRouter.post('/ingest', (req, res) => {
  const raw = req.header('x-extension-token') ?? '';
  if (!raw) return res.status(401).json({ error: 'token ausente' });
  const row = db
    .select()
    .from(extensionTokens)
    .where(and(eq(extensionTokens.tokenHash, hash(raw)), isNull(extensionTokens.revokedAt)))
    .get();
  if (!row) return res.status(401).json({ error: 'token inválido ou revogado' });

  const parsed = batchSchema.strict().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  try {
    activity.ingestExtensionBatch(row.orgId, row.userId, parsed.data as never);
    db.update(extensionTokens)
      .set({ lastUsedAt: new Date().toISOString() })
      .where(eq(extensionTokens.id, row.id))
      .run();
    res.status(202).json({ ok: true });
  } catch (err) {
    res.status(403).json({ error: err instanceof Error ? err.message : 'erro' });
  }
});
