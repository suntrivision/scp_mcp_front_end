import { EXCEPTION_DASHBOARD_PROMPT } from './freppleExceptionDashboardPrompt.js';

/** Match server: models sometimes omit `narrative` or use another key (not `recommendations`). */
function pickNarrativeField(data) {
  if (!data || typeof data !== 'object') return '';
  const keys = ['narrative', 'Narrative', 'analysis', 'commentary', 'explanation'];
  for (const k of keys) {
    const v = data[k];
    if (typeof v === 'string' && v.trim()) return v.trim();
  }
  return '';
}

/** Replace frePPLe / Frepple (any common spelling) with Y3 in narrative text from models. */
function replaceFreppleWithY3InNarrative(text) {
  if (typeof text !== 'string' || !text) return text;
  return text.replace(/\bfre+pple\b/gi, 'Y3');
}

function normalizeRecommendationsResponse(data) {
  if (!data || typeof data !== 'object') return [];
  const r = data.recommendations;
  if (Array.isArray(r)) {
    return r
      .map((x) =>
        typeof x === 'string' ? x.trim() : typeof x === 'number' ? String(x) : ''
      )
      .filter(Boolean);
  }
  if (typeof r === 'string' && r.trim()) {
    return r
      .split(/\n+/)
      .map((s) => s.replace(/^[-*•]\s*/, '').trim())
      .filter(Boolean);
  }
  return [];
}

/**
 * Browser → API base URL → Express → Tally XML (host/port from .env or ?tallyHost=&tallyPort=)
 *
 * Local dev: Vite proxies /api to port 8787 (leave VITE_API_BASE_URL unset).
 * Vercel / static hosting: set VITE_API_BASE_URL to your Node API origin at build time.
 *
 * Optional UI (Tally panel): "Custom" appends tallyHost/tallyPort query params so the API can
 * reach a different Tally instance (disabled on the server when TALLY_ALLOW_CLIENT_OVERRIDE=false).
 *
 * Tally setup: F1 → Settings → Connectivity → TallyPrime as Server, XML port (often 9000).
 */

const LS_TALLY_MODE = 'tallyTargetMode';
const LS_TALLY_HOST = 'tallyCustomHost';
const LS_TALLY_PORT = 'tallyCustomPort';

/** @returns {'local' | 'custom'} */
export function getTallyTargetMode() {
  if (typeof window === 'undefined') return 'local';
  const m = localStorage.getItem(LS_TALLY_MODE);
  return m === 'custom' ? 'custom' : 'local';
}

/** Query fragment for Tally routes: tallyHost=…&tallyPort=… (no leading ?). Empty if local mode. */
export function getTallyConnectionQueryString() {
  if (typeof window === 'undefined') return '';
  if (getTallyTargetMode() !== 'custom') return '';
  const host = String(localStorage.getItem(LS_TALLY_HOST) || '').trim();
  const port = String(localStorage.getItem(LS_TALLY_PORT) || '9000').trim();
  if (!host) return '';
  return `tallyHost=${encodeURIComponent(host)}&tallyPort=${encodeURIComponent(port)}`;
}

export function getStoredTallyCustom() {
  if (typeof window === 'undefined') return { host: '', port: '9000' };
  return {
    host: localStorage.getItem(LS_TALLY_HOST) || '',
    port: localStorage.getItem(LS_TALLY_PORT) || '9000',
  };
}

/** @param {'local' | 'custom'} mode */
export function persistTallyTarget(mode, host, port) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(LS_TALLY_MODE, mode === 'custom' ? 'custom' : 'local');
  localStorage.setItem(LS_TALLY_HOST, (host ?? '').trim());
  localStorage.setItem(LS_TALLY_PORT, (port ?? '9000').trim());
}

function appendTallyQuery(path) {
  const q = getTallyConnectionQueryString();
  if (!q) return path;
  return path.includes('?') ? `${path}&${q}` : `${path}?${q}`;
}

/** @param {string} path Absolute path starting with / e.g. /api/companies */
export function tallyApiUrl(path) {
  const p0 = path.startsWith('/') ? path : `/${path}`;
  const p = appendTallyQuery(p0);
  const base = String(import.meta.env.VITE_API_BASE_URL || '').trim().replace(/\/$/, '');
  return base ? `${base}${p}` : p;
}

async function fetchJSON(path) {
  const r = await fetch(tallyApiUrl(path));
  const text = await r.text();
  let data = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { _nonJson: text };
  }
  if (!r.ok) {
    const detail =
      (typeof data.error === 'string' && data.error) ||
      (typeof data.message === 'string' && data.message) ||
      (data._nonJson && String(data._nonJson).trim().slice(0, 400)) ||
      r.statusText ||
      'Request failed';
    throw new Error(`HTTP ${r.status}: ${detail}`);
  }
  return data;
}

/**
 * @returns {Promise<string[]>} Company names from Tally (list-master / Company collection)
 */
export async function listCompanies() {
  const data = await fetchJSON('/api/companies');
  return data.companies ?? [];
}

/**
 * @param {{ company?: string }} opts - Omit company to use the active company in Tally
 * @returns {Promise<object[]>} Rows: group_name, group_parent, bs_pl, dr_cr, affects_gross_profit
 */
export async function getChartOfAccounts(opts = {}) {
  const q = new URLSearchParams();
  if (opts.company?.trim()) q.set('company', opts.company.trim());
  const qs = q.toString();
  const data = await fetchJSON(`/api/chart-of-accounts${qs ? `?${qs}` : ''}`);
  return data.rows ?? [];
}

/**
 * @param {{ from: string, to: string, company?: string }} opts - Dates YYYY-MM-DD
 * @returns {Promise<object[]>} Rows: ledger_name, group_name, opening_balance, net_debit, net_credit, closing_balance
 */
export async function getTrialBalance(opts) {
  const q = new URLSearchParams({ from: opts.from, to: opts.to });
  if (opts.company?.trim()) q.set('company', opts.company.trim());
  const data = await fetchJSON(`/api/trial-balance?${q}`);
  return data.rows ?? [];
}

/**
 * @param {{ message: string }} opts
 * @returns {Promise<{intent:string,summary:string,kpis:object,rows:object[],narrative?:string,recommendations?:string[],raw?:string,warning?:string}>}
 */
export async function queryFreppleNaturalLanguage(opts) {
  const r = await fetch(tallyApiUrl('/api/frepple/query'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: opts.message }),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) {
    throw new Error(data.error || 'Y3 query failed');
  }
  const narrativeRaw = pickNarrativeField(data);
  const narrative = narrativeRaw ? replaceFreppleWithY3InNarrative(narrativeRaw) : '';
  const recommendations = normalizeRecommendationsResponse(data);
  const summary =
    data.summary == null || data.summary === ''
      ? ''
      : replaceFreppleWithY3InNarrative(String(data.summary));
  return {
    intent: data.intent || 'general_query',
    summary,
    kpis: data.kpis || {},
    rows: Array.isArray(data.rows) ? data.rows : [],
    narrative,
    recommendations,
    raw: data.raw || '',
    warning: data.warning,
  };
}

/**
 * Loads structured exception dashboard data via Y3 MCP (same endpoint as natural language).
 * @returns {Promise<{intent:string,summary:string,kpis:object,rows:object[],raw?:string,warning?:string}>}
 */
export function fetchExceptionDashboard() {
  return queryFreppleNaturalLanguage({ message: EXCEPTION_DASHBOARD_PROMPT });
}

function tryParseJson(text) {
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    return { _nonJson: text };
  }
}

async function fetchTextAndMaybeJson(path, init) {
  const r = await fetch(tallyApiUrl(path), init);
  const text = await r.text();
  const data = tryParseJson(text);
  if (!r.ok) {
    const detail =
      (typeof data.error === 'string' && data.error) ||
      (typeof data.message === 'string' && data.message) ||
      (data._nonJson && String(data._nonJson).trim().slice(0, 400)) ||
      r.statusText ||
      'Request failed';
    throw new Error(`HTTP ${r.status}: ${detail}`);
  }
  return data;
}

/**
 * Generate/import sample trial balance opening balances into TallyPrime (All Masters).
 * By default does a dry run (commit=false). Set commit=true to actually POST.
 */
export async function importSampleTrialBalanceToTally(opts = {}) {
  const company = opts.company ? String(opts.company).trim() : undefined;
  const basis = opts.basis === 'closing' ? 'closing' : 'opening';
  const action = opts.action === 'Alter' ? 'Alter' : 'Create';
  const commit = opts.commit === true;
  const includeOpeningBalances = opts.includeOpeningBalances !== false;

  const data = await fetchTextAndMaybeJson('/api/tally/import-sample-trial-balance', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ company, basis, action, commit, includeOpeningBalances }),
  });
  return data;
}

/** Import sample chart-of-accounts groups into TallyPrime via backend XML post. */
export async function importSampleCoaToTally(opts = {}) {
  const company = opts.company ? String(opts.company).trim() : undefined;
  const action = opts.action === 'Alter' ? 'Alter' : 'Create';
  const commit = opts.commit === true;

  const data = await fetchTextAndMaybeJson('/api/tally/import-sample-coa', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ company, action, commit }),
  });
  return data;
}
