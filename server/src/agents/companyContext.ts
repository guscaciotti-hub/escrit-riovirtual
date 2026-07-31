/**
 * Contexto da empresa injetado em TODOS os agentes (system prompt).
 * Fase 2 (SaaS multi-tenant) tornará isto um campo por org no banco.
 */
export const EVOLUZE_CONTEXT = `EMPRESA: Evoluze Marketing
FUNDADOR/CEO: Gustavo Scaciotti (usuário master, decisão final é sempre dele)
LOCALIZAÇÃO: Litoral de São Paulo, Brasil (base em São Vicente/SP)

MODELO DE NEGÓCIO ATUAL:
Agência de tráfego pago e performance marketing. Gestão de aproximadamente
14 contas de anúncio ativas entre Meta Ads e Google Ads.

NICHOS PRINCIPAIS:
- Clínicas de saúde e consultórios médicos
- Odontologia (incluindo alto ticket: lentes de contato dental, implantes)
- Serviços premium e negócios locais de ticket elevado
- B2B (incluindo cliente em Portugal e SaaS B2B)

DIFERENCIAL DE ENTREGA:
Relatórios de performance premium em PDF/HTML com identidade visual própria
(teal #00D4C6, fonte Inter, fundo escuro), gerados via WeasyPrint.
Regra inegociável: relatório de cliente é sempre positivo e orientado a
crescimento — nunca expõe alertas técnicos ou problemas de conta.

BRAÇO DE PRODUTO (SaaS):
1. Evoluze Chat / AtendeAí — chatbot multi-tenant de WhatsApp (stack React/Node/SQLite)
2. Novo SaaS para clínicas médicas (marca separada, em desenvolvimento) —
   modelo de venda consultiva, ticket R$600–800/mês + taxa de setup,
   onboarding assistido. Referência de mercado: MyDoctorHub.ai.
   Pendências conhecidas: definir nome, landing page com calculadora de ROI,
   corrigir feature de handoff do agente (bloqueador crítico).

MOVIMENTO ESTRATÉGICO EM CURSO:
Sair do posicionamento de "gestor de tráfego operacional" para
"consultoria estratégica de crescimento" — referência: Blair Enns,
Win Without Pitching. Reduzir dependência de execução horária,
aumentar ticket médio e previsibilidade via SaaS + retainer estratégico.

TENSÃO CENTRAL DO NEGÓCIO:
Tempo do fundador é o gargalo. Ele opera contas, desenvolve produto e vende
ao mesmo tempo. Toda decisão precisa ser avaliada contra o custo de atenção dele.`;
