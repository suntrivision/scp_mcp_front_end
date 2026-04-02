import { useCallback, useEffect, useMemo, useState } from 'react';
import { SAMPLE_CHART_OF_ACCOUNTS, SAMPLE_TRIAL_BALANCE } from './tallyShowcaseData.js';
import {
  getChartOfAccounts,
  importSampleCoaToTally,
  getTrialBalance,
  importSampleTrialBalanceToTally,
  listCompanies,
} from './tallyService.js';

function formatTbCell(col, val) {
  if (val === null || val === undefined) return '—';
  if (typeof val === 'number') {
    return val.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  }
  return String(val);
}

function csvEscape(val) {
  const s = String(val ?? '');
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function toCsv(rows) {
  if (!Array.isArray(rows) || rows.length === 0) return '';
  const cols = Object.keys(rows[0]);
  const header = cols.map(csvEscape).join(',');
  const body = rows
    .map((row) => cols.map((c) => csvEscape(row[c])).join(','))
    .join('\n');
  return `${header}\n${body}\n`;
}

function downloadCsv(filename, csvText) {
  const blob = new Blob([csvText], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function defaultDateRange() {
  const to = new Date();
  const from = new Date(to.getFullYear(), to.getMonth(), 1);
  return {
    from: from.toISOString().slice(0, 10),
    to: to.toISOString().slice(0, 10),
  };
}

export default function TallyPanel() {
  const defaults = useMemo(() => defaultDateRange(), []);
  const [companies, setCompanies] = useState([]);
  const [company, setCompany] = useState('');
  const [companiesErr, setCompaniesErr] = useState(null);
  const [companiesLoading, setCompaniesLoading] = useState(true);

  const [coaRows, setCoaRows] = useState([]);
  const [coaLoading, setCoaLoading] = useState(false);
  const [coaErr, setCoaErr] = useState(null);

  const [from, setFrom] = useState(defaults.from);
  const [to, setTo] = useState(defaults.to);
  const [tbRows, setTbRows] = useState([]);
  const [tbLoading, setTbLoading] = useState(false);
  const [tbErr, setTbErr] = useState(null);
  const [sampleCoa, setSampleCoa] = useState(false);
  const [sampleTb, setSampleTb] = useState(false);
  const [importSampleLoading, setImportSampleLoading] = useState(false);
  const [importSampleMsg, setImportSampleMsg] = useState(null);
  const [importSampleErr, setImportSampleErr] = useState(null);
  const [importSamplePreview, setImportSamplePreview] = useState('');
  const [importCoaLoading, setImportCoaLoading] = useState(false);
  const [importCoaMsg, setImportCoaMsg] = useState(null);
  const [importCoaErr, setImportCoaErr] = useState(null);
  const [tbCsvLoading, setTbCsvLoading] = useState(false);
  const [tbCsvMsg, setTbCsvMsg] = useState(null);
  const [tbCsvErr, setTbCsvErr] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setCompaniesLoading(true);
      setCompaniesErr(null);
      try {
        const list = await listCompanies();
        if (!cancelled) setCompanies(list);
      } catch (e) {
        if (!cancelled) setCompaniesErr(e.message || 'Could not load companies');
      } finally {
        if (!cancelled) setCompaniesLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const companyOpts = useMemo(() => {
    const o = { company: company.trim() || undefined };
    return o;
  }, [company]);

  const loadChartOfAccounts = useCallback(async () => {
    setCoaErr(null);
    setCoaLoading(true);
    setCoaRows([]);
    try {
      const rows = await getChartOfAccounts(companyOpts);
      setCoaRows(rows);
      setSampleCoa(false);
    } catch (e) {
      setCoaErr(e.message || 'Chart of accounts failed');
    } finally {
      setCoaLoading(false);
    }
  }, [companyOpts]);

  const loadSampleCoa = useCallback(() => {
    setCoaErr(null);
    setCoaLoading(false);
    setCoaRows(SAMPLE_CHART_OF_ACCOUNTS);
    setSampleCoa(true);
  }, []);

  const loadTrialBalance = useCallback(async () => {
    setTbErr(null);
    setTbLoading(true);
    setTbRows([]);
    try {
      const rows = await getTrialBalance({ from, to, ...companyOpts });
      setTbRows(rows);
      setSampleTb(false);
    } catch (e) {
      setTbErr(e.message || 'Trial balance failed');
    } finally {
      setTbLoading(false);
    }
  }, [from, to, companyOpts]);

  const loadSampleTrialBalance = useCallback(() => {
    setTbErr(null);
    setTbLoading(false);
    setTbRows(SAMPLE_TRIAL_BALANCE);
    setSampleTb(true);
  }, []);

  const loadShowcaseBoth = useCallback(() => {
    setCoaErr(null);
    setTbErr(null);
    setCoaLoading(false);
    setTbLoading(false);
    setCoaRows(SAMPLE_CHART_OF_ACCOUNTS);
    setTbRows(SAMPLE_TRIAL_BALANCE);
    setSampleCoa(true);
    setSampleTb(true);
  }, []);

  const importSampleIntoTally = useCallback(async () => {
    const ok = window.confirm(
      'Import sample trial-balance ledgers into TallyPrime now?\n\nThis uses HTTP import and will create/alter sample ledgers in the selected company.'
    );
    if (!ok) return;

    setImportSampleLoading(true);
    setImportSampleMsg(null);
    setImportSampleErr(null);
    setImportSamplePreview('');
    try {
      const res = await importSampleTrialBalanceToTally({
        company: company.trim() || undefined,
        basis: 'opening',
        action: 'Create',
        includeOpeningBalances: true,
        commit: true,
      });
      if (res?.summary?.ok) {
        setImportSampleMsg(res.summary.message || 'Import accepted by Tally');
      } else {
        setImportSampleErr(res?.summary?.message || 'Tally import failed');
      }
      setImportSamplePreview(res?.rawPreview || '');
    } catch (e) {
      setImportSampleErr(e?.message || 'Tally import failed');
    } finally {
      setImportSampleLoading(false);
    }
  }, [company]);

  const importSampleCoaIntoTally = useCallback(async () => {
    const ok = window.confirm(
      'Import sample chart-of-accounts groups into TallyPrime now?\n\nThis uses HTTP import and will create/alter group masters in the selected company.'
    );
    if (!ok) return;

    setImportCoaLoading(true);
    setImportCoaMsg(null);
    setImportCoaErr(null);
    try {
      const res = await importSampleCoaToTally({
        company: company.trim() || undefined,
        action: 'Create',
        commit: true,
      });
      if (res?.summary?.ok) {
        setImportCoaMsg(res.summary.message || 'COA import accepted by Tally');
      } else {
        setImportCoaErr(res?.summary?.message || 'COA import failed');
      }
    } catch (e) {
      setImportCoaErr(e?.message || 'COA import failed');
    } finally {
      setImportCoaLoading(false);
    }
  }, [company]);

  const downloadTrialBalanceCsv = useCallback(async () => {
    setTbCsvLoading(true);
    setTbCsvMsg(null);
    setTbCsvErr(null);
    try {
      // Pull fresh rows from Tally for selected date range/company before exporting.
      const rows = await getTrialBalance({ from, to, ...companyOpts });
      if (!rows.length) {
        setTbCsvErr('No trial-balance rows found for selected date range.');
        return;
      }
      const csv = toCsv(rows);
      const companySlug = (company.trim() || 'active-company')
        .replace(/[^a-z0-9-_]+/gi, '_')
        .replace(/^_+|_+$/g, '');
      const filename = `trial_balance_${companySlug}_${from}_to_${to}.csv`;
      downloadCsv(filename, csv);
      setTbCsvMsg(`Downloaded ${rows.length} rows to ${filename}`);
    } catch (e) {
      setTbCsvErr(e?.message || 'CSV download failed');
    } finally {
      setTbCsvLoading(false);
    }
  }, [company, companyOpts, from, to]);

  return (
    <section className="card tally-page">
      <div className="card-head">
        <h2>Tally services</h2>
      </div>
      <p className="hint">
        Reads companies, chart of accounts, and trial balance via the Node API (TallyPrime XML on port 9000). Leave
        company blank to use the active company in Tally.{' '}
        <strong>Local:</strong> <code>npm run dev</code> proxies <code>/api</code> to port 8787.{' '}
        <strong>Vercel / static build:</strong> set <code>VITE_API_BASE_URL</code> to your API origin (no trailing slash)
        when building — the CDN has no <code>/api</code>, so without it you will see HTTP 404.{' '}
        API host must allow CORS (this server uses <code>cors: true</code>). On the API machine:{' '}
        <code>TALLY_MCP_ROOT</code>, Tally as server on port 9000 (F1 → Settings → Connectivity).
      </p>
      {import.meta.env.VITE_API_BASE_URL ? (
        <p className="hint small-hint">
          Using API:{' '}
          <code>{String(import.meta.env.VITE_API_BASE_URL).replace(/\/$/, '')}</code>
        </p>
      ) : null}

      <div className="tally-showcase">
        <p className="tally-showcase-title">Showcase (sample data)</p>
        <p className="hint small-hint tally-showcase-copy">
          Demo chart of accounts and trial balance aligned to typical TallyPrime groups — for demos and screenshots
          without live Tally.
        </p>
        <div className="tally-showcase-actions">
          <button
            type="button"
            className="btn"
            onClick={importSampleCoaIntoTally}
            disabled={importCoaLoading || companiesLoading}
            title="Posts sample COA groups (All Masters) to TallyPrime over HTTP."
          >
            {importCoaLoading ? 'Importing COA…' : 'Import sample COA into Tally'}
          </button>
          <button type="button" className="btn" onClick={loadSampleCoa}>
            Sample chart of accounts
          </button>
          <button type="button" className="btn" onClick={loadSampleTrialBalance}>
            Sample trial balance
          </button>
          <button type="button" className="btn primary" onClick={loadShowcaseBoth}>
            Load both
          </button>
        </div>
        {importCoaMsg && <p className="ok">{importCoaMsg}</p>}
        {importCoaErr && <p className="err">{importCoaErr}</p>}
      </div>

      <div className="tally-controls">
        <label className="field">
          <span>Company (optional)</span>
          <div className="company-row">
            <select
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              disabled={companiesLoading}
            >
              <option value="">— Active company in Tally —</option>
              {companies.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <button type="button" className="btn" onClick={loadChartOfAccounts} disabled={coaLoading}>
              {coaLoading ? 'Loading…' : 'Chart of accounts'}
            </button>
          </div>
        </label>
        {companiesErr && <p className="err small">{companiesErr}</p>}
        {companiesLoading && <p className="hint">Loading company list…</p>}
      </div>

      {coaErr && <p className="err">{coaErr}</p>}
      {sampleCoa && coaRows.length > 0 && (
        <p className="hint tally-showcase-tag">Sample chart of accounts (not from live Tally)</p>
      )}
      {coaRows.length > 0 && (
        <div className="table-wrap result-table tally-table">
          <table>
            <thead>
              <tr>
                {Object.keys(coaRows[0]).map((col) => (
                  <th key={col}>{col}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {coaRows.map((row, i) => (
                <tr key={i}>
                  {Object.keys(coaRows[0]).map((col) => (
                    <td key={`${i}-${col}`}>{String(row[col] ?? '—')}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="tally-tb-block">
        <h3 className="tally-subhead">Trial balance</h3>
        <div className="tally-date-row">
          <label className="field">
            <span>From</span>
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </label>
          <label className="field">
            <span>To</span>
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </label>
          <button type="button" className="btn primary" onClick={loadTrialBalance} disabled={tbLoading}>
            {tbLoading ? 'Loading…' : 'Load trial balance'}
          </button>
          <button
            type="button"
            className="btn"
            onClick={downloadTrialBalanceCsv}
            disabled={tbCsvLoading || tbLoading}
            title="Pull trial-balance rows from Tally for current dates and download as CSV."
          >
            {tbCsvLoading ? 'Preparing CSV…' : 'Download trial balance CSV'}
          </button>
        </div>
        {tbErr && <p className="err">{tbErr}</p>}
        {tbCsvMsg && <p className="ok">{tbCsvMsg}</p>}
        {tbCsvErr && <p className="err">{tbCsvErr}</p>}
        <div className="tally-import-sample">
          <button
            type="button"
            className="btn primary"
            onClick={importSampleIntoTally}
            disabled={importSampleLoading || companiesLoading}
            title="Posts XML import to TallyPrime's HTTP server (port 9000). Requires XML server enabled."
          >
            {importSampleLoading ? 'Importing…' : 'Import sample into Tally'}
          </button>
          {importSampleMsg && <p className="ok">{importSampleMsg}</p>}
          {importSampleErr && <p className="err">{importSampleErr}</p>}
          {importSamplePreview ? (
            <pre className="tally-import-preview">{importSamplePreview}</pre>
          ) : null}
        </div>
        {sampleTb && tbRows.length > 0 && (
          <p className="hint tally-showcase-tag">Sample trial balance (not from live Tally)</p>
        )}
        {tbRows.length > 0 && (
          <div className="table-wrap result-table tally-table">
            <table>
              <thead>
                <tr>
                  {Object.keys(tbRows[0]).map((col) => (
                    <th key={col}>{col}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {tbRows.map((row, i) => (
                  <tr key={i}>
                    {Object.keys(tbRows[0]).map((col) => (
                      <td key={`${i}-${col}`}>{formatTbCell(col, row[col])}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}
