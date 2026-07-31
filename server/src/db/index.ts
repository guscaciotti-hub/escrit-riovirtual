import 'dotenv/config';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from './schema.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const serverRoot = path.resolve(__dirname, '..', '..');

/** Resolve o caminho do arquivo SQLite relativo à raiz do server. */
export function resolveDbPath(): string {
  const raw = process.env.DATABASE_URL ?? './data/office.db';
  const abs = path.isAbsolute(raw) ? raw : path.resolve(serverRoot, raw);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  return abs;
}

const dbPath = resolveDbPath();
export const sqlite = new Database(dbPath);
sqlite.pragma('journal_mode = WAL');
sqlite.pragma('foreign_keys = ON');

export const db = drizzle(sqlite, { schema });
export { schema };
export const migrationsFolder = path.resolve(__dirname, 'migrations');
