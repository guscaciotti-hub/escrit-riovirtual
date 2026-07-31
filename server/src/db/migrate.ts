import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { db, migrationsFolder, resolveDbPath } from './index.js';

/**
 * Aplica as migrations geradas pelo drizzle-kit.
 * Idempotente: pode rodar quantas vezes quiser.
 */
function run() {
  console.log(`[migrate] banco: ${resolveDbPath()}`);
  migrate(db, { migrationsFolder });
  console.log('[migrate] migrations aplicadas com sucesso.');
}

run();
