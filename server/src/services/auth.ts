import crypto from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { db } from '../db/index.js';
import { users } from '../db/schema.js';

/**
 * Autenticação própria, sem dependência externa:
 * - senha com scrypt + salt por usuário (node:crypto)
 * - sessão em token assinado por HMAC-SHA256, validade de 7 dias
 */

const SECRET =
  process.env.AUTH_SECRET ??
  (() => {
    // Em dev, deriva uma chave estável do caminho do banco para não deslogar a cada restart.
    return crypto.createHash('sha256').update(`dev:${process.env.DATABASE_URL ?? 'local'}`).digest('hex');
  })();

const SESSION_DAYS = 7;

// ---------- senha ----------

export function hashPassword(plain: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(plain, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

export function verifyPassword(plain: string, stored: string): boolean {
  const [salt, hash] = stored.split(':');
  if (!salt || !hash) return false;
  const attempt = crypto.scryptSync(plain, salt, 64);
  const expected = Buffer.from(hash, 'hex');
  if (attempt.length !== expected.length) return false;
  return crypto.timingSafeEqual(attempt, expected); // comparação em tempo constante
}

// ---------- token ----------

const b64 = (s: string | Buffer) =>
  Buffer.from(s).toString('base64url');

function sign(payload: string): string {
  return crypto.createHmac('sha256', SECRET).update(payload).digest('base64url');
}

export function issueToken(userId: string): string {
  const exp = Date.now() + SESSION_DAYS * 86400_000;
  const body = b64(JSON.stringify({ sub: userId, exp }));
  return `${body}.${sign(body)}`;
}

export function verifyToken(token: string): string | null {
  const [body, sig] = (token ?? '').split('.');
  if (!body || !sig) return null;
  const expected = sign(body);
  if (sig.length !== expected.length) return null;
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  try {
    const { sub, exp } = JSON.parse(Buffer.from(body, 'base64url').toString());
    if (typeof exp !== 'number' || Date.now() > exp) return null;
    return typeof sub === 'string' ? sub : null;
  } catch {
    return null;
  }
}

// ---------- operações ----------

export interface CreateUserInput {
  orgId: string;
  name: string;
  email: string;
  password: string;
  role?: 'master' | 'member';
  look?: number;
}

export function createUser(input: CreateUserInput) {
  const email = input.email.trim().toLowerCase();
  const existing = db.select().from(users).where(eq(users.email, email)).get();
  if (existing) throw new Error('Já existe uma conta com este e-mail.');
  const id = `user_${nanoid(10)}`;
  db.insert(users)
    .values({
      id,
      orgId: input.orgId,
      name: input.name.trim(),
      email,
      role: input.role ?? 'member',
      passwordHash: hashPassword(input.password),
      look: input.look ?? Math.floor(Math.random() * 6),
      avatarConfig: '{}',
    })
    .run();
  return db.select().from(users).where(eq(users.id, id)).get()!;
}

export function authenticate(email: string, password: string) {
  const row = db
    .select()
    .from(users)
    .where(eq(users.email, email.trim().toLowerCase()))
    .get();
  if (!row || !row.isActive || !row.passwordHash) return null;
  if (!verifyPassword(password, row.passwordHash)) return null;
  db.update(users).set({ lastLoginAt: new Date().toISOString() }).where(eq(users.id, row.id)).run();
  return row;
}

export function getUserById(id: string) {
  return db.select().from(users).where(and(eq(users.id, id), eq(users.isActive, true))).get() ?? null;
}

export function savePosition(userId: string, tileX: number, tileY: number) {
  db.update(users).set({ tileX, tileY }).where(eq(users.id, userId)).run();
}
