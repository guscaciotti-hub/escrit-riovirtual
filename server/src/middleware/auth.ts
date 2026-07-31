import type { NextFunction, Request, Response } from 'express';
import { eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { orgs, users } from '../db/schema.js';
import { toOrg, toUser } from '../db/mappers.js';
import type { Org, User } from '@evoluze/shared';

/**
 * Auth abstraída (Fase 4). No MVP single-user retorna o usuário master do seed.
 * Para plugar JWT/Clerk depois: trocar a implementação de `resolveUser` — as
 * rotas continuam usando `getCurrentUser(req)` sem alteração.
 */

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      auth?: { user: User; org: Org };
    }
  }
}

const DEFAULT_ORG_SLUG = process.env.DEFAULT_ORG_SLUG ?? 'evoluze';

let cached: { user: User; org: Org } | null = null;

function resolveUser(_req: Request): { user: User; org: Org } | null {
  if (cached) return cached;
  const orgRow = db.select().from(orgs).where(eq(orgs.slug, DEFAULT_ORG_SLUG)).get();
  if (!orgRow) return null;
  const userRow = db
    .select()
    .from(users)
    .where(eq(users.orgId, orgRow.id))
    .get();
  if (!userRow) return null;
  cached = { user: toUser(userRow), org: toOrg(orgRow) };
  return cached;
}

/** Middleware: injeta req.auth. Todas as rotas de negócio dependem dele. */
export function authMiddleware(req: Request, res: Response, next: NextFunction) {
  const auth = resolveUser(req);
  if (!auth) {
    res.status(401).json({ error: 'Nenhum usuário/org resolvido. Rode db:seed.' });
    return;
  }
  req.auth = auth;
  next();
}

export function getCurrentUser(req: Request): User {
  if (!req.auth) throw new Error('getCurrentUser chamado sem authMiddleware');
  return req.auth.user;
}

export function getCurrentOrg(req: Request): Org {
  if (!req.auth) throw new Error('getCurrentOrg chamado sem authMiddleware');
  return req.auth.org;
}

/** Usado pelos handlers de socket (sem req Express). */
export function resolveDefaultAuth(): { user: User; org: Org } | null {
  return resolveUser({} as Request);
}
