import { useCallback, useEffect, useMemo, useState } from 'react';
import { getChartOfAccounts, getTrialBalance, listCompanies } from './tallyService.js';

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
    } catch (e) {
      setCoaErr(e.message || 'Chart of accounts failed');
    } finally {
      setCoaLoading(false);
    }
  }, [companyOpts]);

  const loadTrialBalance = useCallback(async () => {
    setTbErr(null);
    setTbLoading(true);
    setTbRows([]);
    try {
      const rows = await getTrialBalance({ from, to, ...companyOpts });
      setTbRows(rows);
    } catch (e) {
      setTbErr(e.message || 'Trial balance failed');
    } finally {
      setTbLoading(false);
    }
  }, [from, to, companyOpts]);

  return (
    <section className="card tally-page">
      <div className="card-head">
        <h2>Tally services</h2>
      </div>
      <p className="hint">
        Reads companies, chart of accounts, and trial balance via the local API (TallyPrime XML on port 9000). Leave
        company blank to use the active company in Tally. Run <code>npm run dev</code> so Vite proxies{' '}
        <code>/api</code> to the Node server (port 8787). If an error shows <code>HTTP 502</code>, start the API;
        if <code>Tally MCP not found</code>, set <code>TALLY_MCP_ROOT</code> to your tally-prime folder; if connection
        errors appear, enable Tally as server on port 9000 (F1 → Settings → Connectivity).
      </p>

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
        </div>
        {tbErr && <p className="err">{tbErr}</p>}
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
                      <td key={`${i}-${col}`}>{String(row[col] ?? '—')}</td>
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
