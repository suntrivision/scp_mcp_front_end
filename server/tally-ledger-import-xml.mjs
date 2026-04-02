import { SAMPLE_CHART_OF_ACCOUNTS, SAMPLE_TRIAL_BALANCE } from '../src/tallyShowcaseData.js';

function escapeXml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Map group_name -> { dr_cr } from sample COA */
function coaGroupMap() {
  const m = new Map();
  for (const r of SAMPLE_CHART_OF_ACCOUNTS) {
    m.set(r.group_name, { dr_cr: r.dr_cr, bs_pl: r.bs_pl });
  }
  return m;
}

/**
 * Tally ledger OPENINGBALANCE: debit-nature groups use positive; credit-nature use negative for typical balances.
 * @param {{ group_name: string, opening_balance: number, closing_balance: number }} row
 * @param {'opening' | 'closing'} basis
 */
export function signedAmountForTally(row, basis) {
  const raw =
    basis === 'opening'
      ? Number(row.opening_balance)
      : Number(row.closing_balance ?? row.opening_balance);
  const meta = coaGroupMap().get(row.group_name);
  if (!meta) return raw;
  if (meta.dr_cr === 'C') return -Math.abs(raw);
  return Math.abs(raw);
}

/**
 * Build TallyPrime "Import Data → All Masters" XML for ledgers with opening balances.
 * Parent group must already exist in the company (default TallyPrime groups match our sample names).
 *
 * @param {{ company?: string, basis?: 'opening' | 'closing', action?: 'Create' | 'Alter' }} opts
 */
export function buildSampleLedgerImportXml(opts = {}) {
  const basis = opts.basis === 'opening' ? 'opening' : 'closing';
  const action = opts.action === 'Alter' ? 'Alter' : 'Create';
  const company = opts.company && String(opts.company).trim();
  const includeOpeningBalances = opts.includeOpeningBalances !== false;

  const ledgers = SAMPLE_TRIAL_BALANCE.map((row) => {
    const name = escapeXml(row.ledger_name);
    const parent = escapeXml(row.group_name);
    const ob = includeOpeningBalances ? signedAmountForTally(row, basis) : 0;
    const obStr = includeOpeningBalances
      ? Number.isFinite(ob)
        ? ob.toFixed(4).replace(/\.?0+$/, '')
        : '0'
      : '';
    const obXml = includeOpeningBalances ? `\n            <OPENINGBALANCE>${obStr}</OPENINGBALANCE>` : '';
    return `          <LEDGER NAME="${name}" ACTION="${action}">
            <NAME>${name}</NAME>
            <PARENT>${parent}</PARENT>
            ${obXml}
          </LEDGER>`;
  }).join('\n');

  const desc = company
    ? `<DESC>
    <STATICVARIABLES>
      <SVCURRENTCOMPANY>${escapeXml(company)}</SVCURRENTCOMPANY>
    </STATICVARIABLES>
  </DESC>`
    : '';

  return `<?xml version="1.0" encoding="UTF-8"?>
<ENVELOPE>
  <HEADER>
    <VERSION>1</VERSION>
    <TALLYREQUEST>Import</TALLYREQUEST>
    <TYPE>Data</TYPE>
    <ID>All Masters</ID>
  </HEADER>
  <BODY>
  ${desc}
  <IMPORTDATA>
    <REQUESTDESC>
      <REPORTNAME>All Masters</REPORTNAME>
    </REQUESTDESC>
    <REQUESTDATA>
      <TALLYMESSAGE>
${ledgers}
      </TALLYMESSAGE>
    </REQUESTDATA>
  </IMPORTDATA>
  </BODY>
</ENVELOPE>`;
}

/** Strip UTF-16 response to a short status line for JSON. */
export function tallyResponseSummary(xmlUtf16Response) {
  const t = String(xmlUtf16Response || '');
  if (/<LINEERROR/i.test(t)) {
    const m = t.match(/<LINEERROR[^>]*>([^<]+)/i);
    return { ok: false, message: m ? m[1].trim() : 'LINEERROR in Tally response' };
  }
  // Match only the singular EXCEPTION tag; do not confuse with EXCEPTIONS count.
  if (/<EXCEPTION>/i.test(t)) {
    const m = t.match(/<EXCEPTION[^>]*>([^<]+)/i) || t.match(/<MESSAGE[^>]*>([^<]+)/i);
    return { ok: false, message: m ? m[1].trim() : 'EXCEPTION in Tally response' };
  }
  if (/<STATUS[^>]*>0</i.test(t) || /failed/i.test(t)) {
    return { ok: false, message: 'Tally reported failure (check raw response)' };
  }
  if (/<CREATED/i.test(t) || /<ALTERED/i.test(t) || /<STATUS[^>]*>1</i.test(t)) {
    return { ok: true, message: 'Import accepted by Tally' };
  }
  return { ok: true, message: 'Request completed (verify in Tally)' };
}
