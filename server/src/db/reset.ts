import fs from 'node:fs';
import { resolveDbPath } from './index.js';

/** Apaga o arquivo SQLite (e WAL/SHM). Use antes de migrate+seed do zero. */
function run() {
  const dbPath = resolveDbPath();
  for (const suffix of ['', '-wal', '-shm']) {
    const f = dbPath + suffix;
    if (fs.existsSync(f)) {
      fs.rmSync(f);
      console.log(`[reset] removido ${f}`);
    }
  }
  console.log('[reset] pronto. Rode db:migrate e db:seed.');
}

run();
