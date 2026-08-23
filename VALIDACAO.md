# Validação do registro de atividade — antes de subir infra

Objetivo: rodar **uma semana só com o Gustavo**, na própria máquina, e responder
três perguntas antes de gastar com VPS.

## Como rodar

```bash
npm install && npm run db:migrate && npm run dev
```

Extensão: `chrome://extensions` → Modo do desenvolvedor → **Carregar sem
compactação** → pasta `extension/`. No sistema: **📊 Produtividade → Gerar código
de pareamento** → colar no popup.

Nada disso precisa de servidor externo: a extensão fala com `localhost:3001`.

---

## Pergunta 1 — a classificação bate com o trabalho real?

Abra o popup da extensão no fim do dia e olhe **"Não classificados"**. Essa lista
fica só no seu navegador e existe justamente para calibrar o mapa.

Use **Copiar lista** e adicione o que for recorrente em `DOMAIN_CATEGORIES`
(`shared/src/activity.ts`).

### ⚠️ O ponto mais frágil do desenho atual

Duas categorias estão marcadas como **não-produtivas** e, para uma agência de
mídia paga, isso está provavelmente **errado**:

| Site | Hoje | Realidade na Evoluze |
| --- | --- | --- |
| `instagram.com` | Entretenimento (não-produtivo) | é onde se olha perfil de cliente e criativo — **é trabalho** |
| `youtube.com` | Entretenimento (não-produtivo) | pesquisa de criativo e tutorial — **muitas vezes é trabalho** |

Enquanto isso não for decidido, o número de "tempo não-produtivo" não significa
nada. Três saídas:

1. **Mover para produtivo** — vira `{ id: 'entretenimento', productive: true }`
   em `WEB_CATEGORIES`. Simples, mas perde o sinal de distração real.
2. **Criar categoria `social_trabalho`** separada de entretenimento, e mapear
   `instagram.com` e `youtube.com` para ela.
3. **Largar o julgamento produtivo/não-produtivo** e só reportar tempo por
   categoria, deixando a leitura para o humano. É a opção mais honesta.

Decida isso **depois** de ver uma semana de dados reais, não antes.

---

## Pergunta 2 — o dado é acionável?

Ao fim da semana, olhe o painel e responda: **alguma decisão mudaria por causa
disso?** Exemplos do que seria acionável:

- "gastei 11h em Mídia paga e 6h em Comunicação — WhatsApp está comendo meu dia"
- "3h em Documentos = relatório manual demais, dá para automatizar"
- "tempo de Foco no escritório virtual está perto de zero, só reunião"

Se nada mudar de decisão, o produto não justifica VPS — e o certo é medir
**entrega** em vez de tempo.

## Pergunta 3 — o registro aguenta um dia real?

- [ ] O total de horas bate aproximadamente com o dia trabalhado?
- [ ] Ociosidade fez sentido (almoço, reunião fora do PC)?
- [ ] A pausa funcionou e o período pausado não foi contado?
- [ ] Sobrou algo grande em "Outros"?
- [ ] O service worker continuou registrando o dia todo? (Chrome mata SW ocioso;
      o `chrome.alarms` deve reanimar — confirmar que não há buraco no gráfico)

---

## Só depois disso: infra

Se as três respostas forem boas, aí sim vale VPS. O que precisa mudar:

1. `host_permissions` no `extension/manifest.json` → domínio real
2. `VITE_SERVER_URL` e `CLIENT_ORIGIN` no `.env`
3. TLS obrigatório (front em https não fala com backend http)
4. SQLite precisa de **disco persistente** — descarta Vercel/Netlify functions

Specs: 1 vCPU / 1 GB RAM sobra.

## Pendência conhecida

`interventionsCount` existe no banco mas fica sempre 0 — contar intervenções do
CEO em reunião exige mexer no `MeetingOrchestrator`. **TODO**, não implementado.
