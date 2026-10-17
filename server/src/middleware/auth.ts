import type { NextFunction, Request, Response } from 'express';
import { eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { orgs } from '../db/schema.js';
import { toOrg, toUser } from '../db/mappers.js';
import { getUserById, verifyToken } from '../services/auth.js';
import type { Org, User } from '@evoluze/shared';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      auth?: { user: User; org: Org };
    }
  }
}

/** Resolve a sessão a partir do token. Retorna null se não houver sessão válida. */
export function resolveAuth(token: string): { user: User; org: Org } | null {
  const userId = verifyToken(token);
  if (!userId) return null;
  const row = getUserById(userId);
  if (!row) return null;
  const orgRow = db.select().from(orgs).where(eq(orgs.id, row.orgId)).get();
  if (!orgRow) return null;
  return { user: toUser(row), org: toOrg(orgRow) };
}

function bearerOf(req: Request): string {
  const h = req.header('authorization') ?? '';
  return h.startsWith('Bearer ') ? h.slice(7) : '';
}

/** Exige sessão válida. Todas as rotas de negócio passam por aqui. */
export function authMiddleware(req: Request, res: Response, next: NextFunction) {
  const auth = resolveAuth(bearerOf(req));
  if (!auth) {
    res.status(401).json({ error: 'Faça login para continuar.' });
    return;
  }
  req.auth = auth;
  next();
}

/** Deixa passar sem sessão (usado nas rotas de login). */
export function optionalAuth(req: Request, _res: Response, next: NextFunction) {
  req.auth = resolveAuth(bearerOf(req)) ?? undefined;
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
