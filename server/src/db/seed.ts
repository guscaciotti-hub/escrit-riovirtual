import { ROOMS, tileToPx } from '@evoluze/shared';
import { db, sqlite } from './index.js';
import { agents, orgs, rooms, users } from './schema.js';
import { EVOLUZE_CONTEXT } from '../agents/companyContext.js';
import ricardo from '../agents/personas/ricardo.json' with { type: 'json' };
import camila from '../agents/personas/camila.json' with { type: 'json' };
import teo from '../agents/personas/teo.json' with { type: 'json' };

const PERSONAS = [ricardo, camila, teo];

const ORG_ID = 'org_evoluze';
const USER_ID = 'user_gustavo';

/**
 * Popula org Evoluze + Gustavo (master) + 3 agentes + salas.
 * Idempotente via INSERT OR REPLACE (ids determinísticos).
 */
function seed() {
  console.log('[seed] iniciando...');

  db.insert(orgs)
    .values({ id: ORG_ID, name: 'Evoluze Marketing', slug: 'evoluze' })
    .onConflictDoNothing()
    .run();

  db.insert(users)
    .values({
      id: USER_ID,
      orgId: ORG_ID,
      name: 'Gustavo Scaciotti',
      email: 'gustavopaidtraffic@gmail.com',
      role: 'master',
      avatarConfig: JSON.stringify({ sprite: 'ceo', tint: '#00D4C6' }),
    })
    .onConflictDoNothing()
    .run();

  // Salas a partir do layout canônico (bounds em tiles).
  for (const r of ROOMS) {
    db.insert(rooms)
      .values({
        id: r.id,
        orgId: ORG_ID,
        name: r.name,
        type: r.type,
        bounds: JSON.stringify(r.bounds),
        capacity: r.type === 'meeting' ? 8 : 12,
      })
      .onConflictDoNothing()
      .run();
  }

  // Agentes a partir das personas seed.
  for (const p of PERSONAS) {
    const px = tileToPx(p.spawnTile as { x: number; y: number });
    // Injeta o contexto da empresa no fim do system prompt de cada agente.
    const systemPrompt = `${p.personaSystemPrompt}\n\n=== CONTEXTO DA EMPRESA ===\n${EVOLUZE_CONTEXT}`;
    db.insert(agents)
      .values({
        id: `agent_${p.key}`,
        orgId: ORG_ID,
        name: p.name,
        jobTitle: p.jobTitle,
        department: p.department,
        avatarConfig: JSON.stringify(p.avatarConfig),
        spawnX: px.x,
        spawnY: px.y,
        deskId: p.deskId,
        personaSystemPrompt: systemPrompt,
        personalityTraits: JSON.stringify(p.personalityTraits),
        knowledgeScope: p.knowledgeScope,
        model: p.model as 'claude-sonnet-4-6' | 'claude-haiku-4-5',
        isActive: true,
      })
      .onConflictDoNothing()
      .run();
    console.log(`[seed] agente ${p.name} (${p.jobTitle})`);
  }

  const count = sqlite.prepare('SELECT COUNT(*) as n FROM agents').get() as { n: number };
  console.log(`[seed] pronto. ${count.n} agentes no banco. Org=${ORG_ID}, User=${USER_ID}.`);
}

seed();
