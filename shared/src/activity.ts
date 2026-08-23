/**
 * Produtividade / atividade.
 *
 * REGRA CENTRAL DE PRIVACIDADE: a URL nunca sai da máquina do usuário.
 * A extensão resolve o domínio para uma CATEGORIA localmente e envia apenas
 * { category, seconds }. O servidor não tem como reconstruir o histórico
 * de navegação — só sabe "40 min em ADS", nunca "qual campanha".
 */

/** Versão da política de monitoramento. Suba ao mudar o texto: força novo aceite. */
export const ACTIVITY_POLICY_VERSION = '2026-08-01.v1';

/** Retenção de evento bruto. Depois disso só sobra o agregado diário. */
export const ACTIVITY_RETENTION_DAYS = 30;

/** Sem sinal por este tempo => conta como ocioso, não como trabalho. */
export const IDLE_THRESHOLD_SECONDS = 300;

export type WebCategory =
  | 'ads'
  | 'analytics'
  | 'dev'
  | 'design'
  | 'comunicacao'
  | 'documentos'
  | 'pesquisa'
  | 'gestao'
  | 'entretenimento'
  | 'pessoal'
  | 'outros';

export interface CategoryMeta {
  id: WebCategory;
  label: string;
  /** conta como trabalho no cálculo de produtividade */
  productive: boolean;
  color: string;
}

export const WEB_CATEGORIES: CategoryMeta[] = [
  { id: 'ads', label: 'Mídia paga', productive: true, color: '#00D4C6' },
  { id: 'analytics', label: 'Analytics', productive: true, color: '#3DDC97' },
  { id: 'dev', label: 'Desenvolvimento', productive: true, color: '#7B61FF' },
  { id: 'design', label: 'Design', productive: true, color: '#F075B5' },
  { id: 'comunicacao', label: 'Comunicação', productive: true, color: '#4EA8DE' },
  { id: 'documentos', label: 'Documentos', productive: true, color: '#8FD14F' },
  { id: 'pesquisa', label: 'Pesquisa', productive: true, color: '#FFC24B' },
  { id: 'gestao', label: 'Gestão', productive: true, color: '#B39DDB' },
  { id: 'entretenimento', label: 'Entretenimento', productive: false, color: '#E4572E' },
  { id: 'pessoal', label: 'Pessoal', productive: false, color: '#9AA5B8' },
  { id: 'outros', label: 'Outros', productive: false, color: '#5C6784' },
];

/**
 * Mapa domínio -> categoria, usado SOMENTE dentro da extensão (no cliente).
 * Fica aqui para ser a fonte única e auditável do que é classificado como quê.
 */
export const DOMAIN_CATEGORIES: Record<string, WebCategory> = {
  'business.facebook.com': 'ads',
  'adsmanager.facebook.com': 'ads',
  'facebook.com': 'ads',
  'ads.google.com': 'ads',
  'tiktok.com': 'ads',
  'ads.tiktok.com': 'ads',
  'linkedin.com': 'comunicacao',
  'analytics.google.com': 'analytics',
  'search.google.com': 'analytics',
  'tagmanager.google.com': 'analytics',
  'lookerstudio.google.com': 'analytics',
  'metabase.com': 'analytics',
  'github.com': 'dev',
  'gitlab.com': 'dev',
  'stackoverflow.com': 'dev',
  'vercel.com': 'dev',
  'netlify.com': 'dev',
  'supabase.com': 'dev',
  'claude.ai': 'dev',
  'figma.com': 'design',
  'canva.com': 'design',
  'mail.google.com': 'comunicacao',
  'gmail.com': 'comunicacao',
  'web.whatsapp.com': 'comunicacao',
  'slack.com': 'comunicacao',
  'meet.google.com': 'comunicacao',
  'zoom.us': 'comunicacao',
  'docs.google.com': 'documentos',
  'drive.google.com': 'documentos',
  'sheets.google.com': 'documentos',
  'notion.so': 'documentos',
  'google.com': 'pesquisa',
  'chatgpt.com': 'pesquisa',
  'trello.com': 'gestao',
  'asana.com': 'gestao',
  'clickup.com': 'gestao',
  'youtube.com': 'entretenimento',
  'netflix.com': 'entretenimento',
  'instagram.com': 'entretenimento',
  'x.com': 'entretenimento',
  'twitter.com': 'entretenimento',
  'reddit.com': 'entretenimento',
};

/** Resolve um hostname para categoria. Roda no cliente, nunca no servidor. */
export function categorizeHost(hostname: string): WebCategory {
  const host = hostname.toLowerCase().replace(/^www\./, '');
  if (DOMAIN_CATEGORIES[host]) return DOMAIN_CATEGORIES[host];
  const parts = host.split('.');
  for (let i = 1; i < parts.length - 1; i++) {
    const parent = parts.slice(i).join('.');
    if (DOMAIN_CATEGORIES[parent]) return DOMAIN_CATEGORIES[parent];
  }
  return 'outros';
}

// ---------- Tipos de API ----------

export type ActivityScope = 'office' | 'extension';

export interface ActivityConsent {
  scope: ActivityScope;
  policyVersion: string;
  acceptedAt: string | null;
  revokedAt: string | null;
  /** true se aceitou a versão ATUAL da política */
  current: boolean;
}

export interface DailyActivity {
  date: string;
  userId: string;
  userName: string;
  secondsOffice: number;
  secondsFocus: number;
  secondsMeeting: number;
  secondsLounge: number;
  secondsIdle: number;
  meetingsCount: number;
  interventionsCount: number;
  webCategories: Partial<Record<WebCategory, number>>;
}

export interface ActivitySummary {
  from: string;
  to: string;
  days: DailyActivity[];
  totals: {
    secondsOffice: number;
    secondsFocus: number;
    secondsMeeting: number;
    secondsIdle: number;
    secondsProductiveWeb: number;
    secondsUnproductiveWeb: number;
    meetingsCount: number;
  };
}

/** Lote enviado pela extensão. Só categoria + duração. Sem URL, sem título. */
export interface ExtensionBatch {
  /** ISO date YYYY-MM-DD a que o lote se refere */
  date: string;
  entries: Array<{ category: WebCategory; seconds: number }>;
  idleSeconds: number;
}
