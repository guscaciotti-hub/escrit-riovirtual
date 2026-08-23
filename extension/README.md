# Evoluze — Registro de Atividade (extensão)

Registra **tempo por categoria de site**. Não registra endereços, títulos de
página, capturas de tela nem teclas digitadas.

## Como funciona (e por que é seguro)

A URL da aba ativa é lida **em memória**, convertida em categoria
(`ads`, `comunicacao`, `entretenimento`…) e **descartada na mesma função**.
O que sai do seu computador é só isto:

```json
{ "date": "2026-08-23", "entries": [{ "category": "ads", "seconds": 5400 }], "idleSeconds": 600 }
```

O servidor **rejeita** qualquer payload com campo a mais — se alguém tentar
enviar uma URL junto, a requisição falha em vez de gravar. (Ver
`batchSchema.strict()` em `server/src/routes/activity.ts`.)

## Instalar

1. Abra `chrome://extensions` (ou `edge://extensions`)
2. Ative **Modo do desenvolvedor**
3. **Carregar sem compactação** → selecione esta pasta `extension/`
4. No escritório virtual, abra **📊 Produtividade → Gerar código de pareamento**
5. Clique no ícone da extensão, cole o código e o endereço do servidor → **Conectar**

## Controles

- **Pausar registro** — nada é contado enquanto estiver pausado
- **Enviar agora** — força o envio do acumulado
- **Desconectar e apagar local** — remove o pareamento e limpa o armazenamento local

## Onde ficam os dados

| Onde | O quê | Por quanto tempo |
| --- | --- | --- |
| Navegador (`chrome.storage.local`) | acumulado do dia, ainda não enviado | até o envio |
| Servidor — evento bruto | categoria + segundos | 30 dias |
| Servidor — agregado diário | totais por dia | permanente |

Envio a cada 5 minutos. Ociosidade após 5 minutos sem interação conta como
"ocioso", não como trabalho.

## Ajustar a classificação

O mapa domínio → categoria está em `shared/src/activity.ts`
(`DOMAIN_CATEGORIES`). A extensão busca esse mapa do servidor e o mantém em
cache; para reclassificar um site, edite lá.
