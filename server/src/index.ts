import 'dotenv/config';
import http from 'node:http';
import express from 'express';
import cors from 'cors';
import { Server } from 'socket.io';
import type { ClientToServerEvents, ServerToClientEvents } from '@evoluze/shared';
import { authMiddleware } from './middleware/auth.js';
import { orgRouter } from './routes/org.js';
import { agentsRouter } from './routes/agents.js';
import { meetingsRouter } from './routes/meetings.js';
import { chatRouter } from './routes/chat.js';
import { registerSockets } from './sockets/index.js';
import { hasApiKey } from './services/anthropic.js';

const PORT = Number(process.env.PORT ?? 3001);
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN ?? 'http://localhost:5173';

const app = express();
app.use(cors({ origin: CLIENT_ORIGIN, credentials: true }));
app.use(express.json({ limit: '1mb' }));

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, llmEnabled: hasApiKey() });
});

// Todas as rotas de negócio passam pela auth abstraída (Fase 4).
app.use('/api', authMiddleware);
app.use('/api', orgRouter);
app.use('/api/agents', agentsRouter);
app.use('/api/meetings', meetingsRouter);
app.use('/api/chat', chatRouter);

const server = http.createServer(app);
const io = new Server<ClientToServerEvents, ServerToClientEvents>(server, {
  cors: { origin: CLIENT_ORIGIN, credentials: true },
});
registerSockets(io);

server.listen(PORT, () => {
  console.log(`[server] http://localhost:${PORT}  (client: ${CLIENT_ORIGIN})`);
  console.log(`[server] LLM ${hasApiKey() ? 'ATIVO' : 'DESATIVADO (defina ANTHROPIC_API_KEY para chat/reuniões)'}`);
});
