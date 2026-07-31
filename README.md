# 🏢 Escritório Virtual — Evoluze

Escritório virtual 2D top-down (estilo Gather.town) onde o CEO circula por um
mapa em pixel art e convoca **agentes de IA autônomos** — colegas de trabalho
com persona, memória e função — para reuniões onde eles debatem entre si,
discordam, convergem e entregam uma **ata com plano de ação**.

Os agentes **não gastam token parados na mesa**. Só há chamada à API da Anthropic
em (a) chat 1:1 iniciado por você e (b) reunião ativa.

> Empresa seed: **Evoluze Marketing** · CEO: **Gustavo Scaciotti** · 3 agentes:
> Ricardo (Comercial/CRO), Camila (Performance & Mídia), Téo (Produto & Growth).

## Stack

React 18 + TypeScript + Vite · Phaser 3 · Zustand · TailwindCSS ·
Node + Express · Socket.io · SQLite (better-sqlite3) + Drizzle ORM ·
Anthropic SDK · mapa em Tiled (`.tmj`).

## Estrutura

```
/shared   tipos + contratos socket + layout do mapa (fonte única de verdade)
/server   Express + Socket.io + Drizzle + motor de agentes + orquestrador
/client   React + Phaser (cena do escritório) + HUD/painéis + store
```

## Como rodar

Pré-requisito: Node 20+.

```bash
# 1. instalar tudo
npm install

# 2. configurar ambiente (a chave é opcional para andar pelo mapa)
cp .env.example .env
# edite .env e coloque ANTHROPIC_API_KEY=... para habilitar chat e reuniões

# 3. migrar e popular o banco (org Evoluze + Gustavo + 3 agentes + salas)
npm run db:migrate
npm run db:seed
# (ou tudo de uma vez: npm run setup)

# 4. subir client + server juntos
npm run dev
```

- Client: http://localhost:5173
- Server: http://localhost:3001

### Scripts úteis

| Script | O quê |
| --- | --- |
| `npm run dev` | sobe client + server juntos (concurrently) |
| `npm run db:generate` | gera migration a partir do schema Drizzle |
| `npm run db:migrate` | aplica migrations |
| `npm run db:seed` | popula org/usuário/agentes/salas |
| `npm run db:reset` | apaga o SQLite (rode migrate+seed depois) |
| `npm run typecheck` | typecheck de shared + server + client |
| `npm run build` | build de produção |

## Preview online (GitHub Pages)

O workflow `.github/workflows/deploy-pages.yml` builda o client e publica no
GitHub Pages a cada push desta branch. **Ative o Pages uma vez** (o token do CI
não tem permissão para criar o site sozinho):

> Settings → Pages → **Source: GitHub Actions** → salvar.

Depois disso, rode o workflow (Actions → "Deploy preview (GitHub Pages)" →
Run workflow) e o site fica em:
`https://guscaciotti-hub.github.io/escrit-riovirtual/`

O preview roda em **modo offline**: mapa, movimentação, agentes nas mesas,
proximidade e minimapa funcionam. Chat 1:1 e reuniões exigem o backend local
com `ANTHROPIC_API_KEY` (gastam tokens de verdade).

## Controles

- **WASD / setas** — andar
- **E** — falar com o agente próximo (chat 1:1)
- **Convocar Reunião** (HUD) — escolher pauta, participantes, duração e modo
- **+ Novo agente** (HUD) — criar um 4º agente que aparece no mapa (Fase 4)

## Fluxo de reunião

1. Convoca no HUD (título, pauta, participantes, rounds, modo, limite de tokens).
2. Os agentes caminham (A*) até a Sala de Reunião e sentam. Você também precisa
   estar na sala para começar.
3. Abertura → debate dinâmico (eles se citam e discordam) → convergência.
   Você pode **intervir digitando** a qualquer momento (peso máximo).
4. Ao fim: **ata** com resumo, decisões, action items e pontos em aberto —
   exportável em **Markdown** e **PDF**.
5. Custo estimado antes e custo real durante, com limite que força a convergência.

## Custo / modelos

- Debate: `claude-haiku-4-5` · Abertura, convergência e ata: `claude-sonnet-4-6`.
- `max_tokens` por fala ~350. Histórico resumido progressivamente após o round 6.

Veja **DECISIONS.md** para o racional das escolhas técnicas.
