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
 * Browser → Vite dev server → Express (same origin) → Tally XML on localhost:9000
 *
 * Why not call Tally from React directly?
 * - Browsers block cross-origin requests to arbitrary ports (CORS).
 * - Tally’s XML endpoint expects UTF-16 LE bodies; your Express layer (tally.mjs) already matches that.
 *
 * Tally setup (not ODBC): F1 → Settings → Connectivity → Client/Server configuration →
 * TallyPrime acts as Server, port 9000 (XML). ODBC is a different feature.
 */

async function fetchJSON(path) {
  const r = await fetch(path);
  const data = await r.json().catch(() => ({}));
  if (!r.ok) {
    throw new Error(data.error || r.statusText || 'Request failed');
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
  const r = await fetch('/api/frepple/query', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: opts.message }),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) {
    throw new Error(data.error || 'Y3 query failed');
  }
  const narrative = pickNarrativeField(data);
  const recommendations = normalizeRecommendationsResponse(data);
  return {
    intent: data.intent || 'general_query',
    summary: data.summary || '',
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
