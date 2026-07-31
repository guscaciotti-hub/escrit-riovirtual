# DECISIONS.md

Registro das decisões técnicas tomadas durante a construção. Como pedido no
brief: decisões técnicas óbvias foram tomadas sem perguntar e documentadas aqui.

## Arquitetura

- **Monorepo com npm workspaces** (`/shared`, `/server`, `/client`). Evita
  publicar pacotes e permite que client e server importem os mesmos tipos de
  `@evoluze/shared` diretamente do fonte TS (Vite e tsx consomem `.ts` sem build).
- **`/shared` como fonte única de verdade** para tipos de domínio, contratos de
  Socket.io, layout do mapa (`mapLayout.ts`) e formatação da ata. Nada de
  duplicar interface entre as pontas.
- **Multi-tenant desde o dia 1**: `org_id` em todas as tabelas de negócio; todo
  acesso passa pelo repositório org-scoped (`server/src/db/repo.ts`); auth
  abstraída atrás de `getCurrentUser(req)`/`getCurrentOrg(req)`
  (`server/src/middleware/auth.ts`). No MVP retorna o usuário do seed; para
  plugar JWT/Clerk depois, troca-se só a função `resolveUser` — as rotas não mudam.
- **Socket.io com rooms por `org_id`** (`org:<id>`) mesmo com 1 usuário, já
  pronto para multiplayer.

## Banco

- **SQLite (better-sqlite3) + Drizzle ORM**, migrations desde o dia 1
  (`server/src/db/migrations`). Timestamps em ISO-8601 (TEXT) e JSONs em TEXT
  para portar direto ao Postgres trocando só o driver/dialect do Drizzle.
- IDs determinísticos no seed (`org_evoluze`, `user_gustavo`, `agent_ricardo`…)
  para seed idempotente (`onConflictDoNothing`).

## Mapa

- **Mapa carregado de arquivo Tiled `.tmj`** (`client/public/assets/maps/office.tmj`),
  não hardcoded. O arquivo é **gerado** por `client/scripts/genMap.mjs` a partir
  das constantes de layout, e roda automaticamente no `predev`/`prebuild`.
- **Placeholders programáticos**: como o pack de tiles comercial (LimeZu Modern
  Office) ainda não está na pasta, a `OfficeScene` desenha cada tile como
  retângulo colorido por GID lógico (`game/config.ts`). O `.tmj` já tem a
  estrutura de camadas (`floor`, `walls`, `furniture`, `furniture_top`, `zones`)
  e um tileset placeholder. Para usar o pack real: adicionar o PNG em
  `/public/assets/tilesets`, apontar o tileset no `.tmj` e trocar o render de
  retângulos por tiles — colisão, zonas e pathfinding não mudam.
- **Duplicação consciente**: os números do layout vivem em `shared/src/mapLayout.ts`
  (consumidos por server/seed e client em runtime) e são espelhados à mão em
  `genMap.mjs` (que roda em node puro, sem loader de TS). Se mudar um, mude o outro.
  As paredes de colisão vêm do `.tmj`; assentos/mesas/spawn vêm do `mapLayout`.

## Engine

- **Phaser 3 com Arcade Physics** para movimento do player + colisão via
  static bodies gerados a partir da camada `walls`/`furniture`. Câmera com
  `startFollow` (lerp) e `setBounds` (clamp).
- **Personagens como containers desenhados** (corpo + cabeça + indicador de
  direção + pill de nome + status dot), com respiração idle e bob de caminhada.
  Trocáveis por spritesheet real sem mexer no resto.
- **Ponte Phaser ↔ React** via um event bus tipado (`lib/gameBus.ts`), mantendo
  a UI (HUD, chat, modais, transcrição) em React por cima do canvas e o estado
  em Zustand.
- **Pathfinding A*** simples em grid 4-direções (`game/systems/pathfinding.ts`),
  rodando no client (onde a grade de colisão já existe). O servidor só diz o
  tile-alvo do assento; o client acha o caminho e anima.

## Motor de agentes / custo

- **Regra de ouro**: nenhuma chamada à API com agente parado. Só há chamada em
  (a) chat 1:1 e (b) reunião ativa. Não existe loop autônomo em background.
- **Modelos por fase da fala**: debate usa `claude-haiku-4-5`; abertura,
  convergência e geração da ata usam `claude-sonnet-4-6` (configurável por agente
  no banco). `max_tokens` por fala capado em ~350.
- **Controle de custo real**: estimativa antes de confirmar
  (`services/tokenBudget.ts`), custo acumulado em tempo real no HUD da reunião,
  e limite de tokens que força o round final de convergência.
- **Resumo progressivo** do histórico após o round 6, mantendo só as ~10 falas
  recentes no contexto para não estourar a janela.
- **Seleção dinâmica de quem fala** (não round-robin): relevância ao
  `knowledge_scope`, citação direta pelo nome na fala anterior, trait de
  assertividade e penalidade por falar seguido.

## Export da ata

- **Markdown** gerado no servidor (`GET /api/meetings/:id/export.md`) e também
  no client (offline). **PDF** gerado no client com `jsPDF` (sem dependência
  nativa/servidor de PDF). O brief menciona WeasyPrint para relatórios de
  cliente — isso é outro produto (relatório premium), fora do escopo da ata.

## Preview hospedado

- O client tem **fallback offline** (`lib/api.ts`): se o backend não responder,
  ele monta um bootstrap local (mapa + 3 agentes) para que o escritório seja
  explorável standalone. No preview hospedado (estático) dá para **andar, ver os
  agentes, proximidade e minimapa**; **chat 1:1 e reuniões** exigem o backend
  local + `ANTHROPIC_API_KEY` (gastam tokens) e rodam com `npm run dev`.

## Pendências conhecidas / próximos passos

- Trocar placeholders pelo pack de tiles e spritesheets reais.
- `max_rounds` vs `duration_minutes`: hoje a duração é em rounds; a conversão de
  "minutos simulados → rounds" é trivial de plugar no modal.
- Bundle do client é grande (Phaser ~1MB): code-splitting opcional depois.
