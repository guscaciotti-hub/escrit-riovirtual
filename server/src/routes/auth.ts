import { Router, type NextFunction, type Request, type Response } from 'express';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { users } from '../db/schema.js';
import { toUser } from '../db/mappers.js';
import { authenticate, createUser, getUserById, issueToken, verifyToken } from '../services/auth.js';

export const authRouter = Router();

const loginSchema = z.object({
  email: z.string().email('E-mail inválido'),
  password: z.string().min(1, 'Informe a senha'),
});

authRouter.post('/login', (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Dados inválidos' });
  }
  const row = authenticate(parsed.data.email, parsed.data.password);
  // Mensagem única para não revelar se o e-mail existe.
  if (!row) return res.status(401).json({ error: 'E-mail ou senha incorretos.' });
  res.json({ token: issueToken(row.id), user: toUser(row) });
});

authRouter.get('/me', (req, res) => {
  const id = verifyToken(bearer(req));
  const row = id ? getUserById(id) : null;
  if (!row) return res.status(401).json({ error: 'Sessão expirada.' });
  res.json(toUser(row));
});

const registerSchema = z.object({
  name: z.string().min(2, 'Nome muito curto'),
  email: z.string().email('E-mail inválido'),
  password: z.string().min(6, 'A senha precisa de ao menos 6 caracteres'),
  role: z.enum(['master', 'member']).default('member'),
  look: z.number().int().min(0).max(5).optional(),
});

/** Cadastro de colaborador — só o gestor pode. */
authRouter.post('/team', requireMaster, (req, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Dados inválidos' });
  }
  try {
    const row = createUser({ orgId: req.auth!.org.id, ...parsed.data });
    res.status(201).json(toUser(row));
  } catch (err) {
    res.status(409).json({ error: err instanceof Error ? err.message : 'Erro ao cadastrar' });
  }
});

authRouter.get('/team', requireMaster, (req, res) => {
  const rows = db.select().from(users).where(eq(users.orgId, req.auth!.org.id)).all();
  res.json(rows.map(toUser));
});

/** Ativa/desativa acesso de um colaborador. */
authRouter.patch('/team/:id', requireMaster, (req, res) => {
  const body = z.object({ isActive: z.boolean() }).safeParse(req.body);
  if (!body.success) return res.status(400).json({ error: 'Payload inválido' });
  if (req.params.id === req.auth!.user.id) {
    return res.status(400).json({ error: 'Você não pode desativar a própria conta.' });
  }
  db.update(users).set({ isActive: body.data.isActive }).where(eq(users.id, req.params.id)).run();
  const row = db.select().from(users).where(eq(users.id, req.params.id)).get();
  if (!row) return res.status(404).json({ error: 'Usuário não encontrado' });
  res.json(toUser(row));
});

function bearer(req: Request): string {
  const h = req.header('authorization') ?? '';
  return h.startsWith('Bearer ') ? h.slice(7) : '';
}

function requireMaster(req: Request, res: Response, next: NextFunction) {
  if (!req.auth || req.auth.user.role !== 'master') {
    res.status(403).json({ error: 'Apenas o gestor pode gerenciar a equipe.' });
    return;
  }
  next();
}

export { bearer };
