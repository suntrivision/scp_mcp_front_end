import { useCallback, useMemo, useState } from 'react';
import { fetchExceptionDashboard } from './tallyService.js';
import { EXCEPTION_DASHBOARD_PROMPT } from './freppleExceptionDashboardPrompt.js';

const KPI_ORDER = [
  'Late demand',
  'Unplanned demand',
  'Forecast deviation',
  'Excess inventory',
  'Stockout risk',
  'Delivery order issue',
  'Distribution order issue',
];

const SEVERITY_LEVEL = { High: 0, Medium: 1, Low: 2 };

function normalizeRow(raw) {
  const item =
    raw.item ??
    raw.Item ??
    raw.item_id ??
    raw['Item'] ??
    '—';
  const location =
    raw.location ??
    raw.Location ??
    raw.location_id ??
    '—';
  const exceptionType =
    raw.exception_type ??
    raw.exceptionType ??
    raw['Exception Type'] ??
    '—';
  let severity = raw.severity ?? raw.Severity ?? 'Low';
  if (typeof severity === 'string') {
    const s = severity.trim();
    const cap = s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
    if (cap === 'High' || cap === 'Medium' || cap === 'Low') severity = cap;
    else if (/high/i.test(s)) severity = 'High';
    else if (/medium/i.test(s)) severity = 'Medium';
    else severity = 'Low';
  } else severity = 'Low';
  const recommendedAction =
    raw.recommended_action ??
    raw.recommendedAction ??
    raw['Recommended Action'] ??
    '—';
  return {
    item: String(item),
    location: String(location),
    exception_type: String(exceptionType),
    severity,
    recommended_action: String(recommendedAction),
  };
}

function severityClass(sev) {
  if (sev === 'High') return 'sev-high';
  if (sev === 'Medium') return 'sev-medium';
  return 'sev-low';
}

export function ExceptionDashboardPromptPanel() {
  const [copied, setCopied] = useState(false);
  const copy = useCallback(() => {
    void navigator.clipboard?.writeText(EXCEPTION_DASHBOARD_PROMPT);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, []);
  return (
    <details className="exception-prompt-details">
      <summary>MCP prompt (copy for Claude / backend)</summary>
      <p className="hint">
        This is the same text sent when you refresh the dashboard. Use it in other tools or backend prompts if needed.
      </p>
      <div className="prompt-actions">
        <button type="button" className="btn" onClick={copy}>
          {copied ? 'Copied' : 'Copy prompt'}
        </button>
      </div>
      <pre className="exception-prompt-pre">{EXCEPTION_DASHBOARD_PROMPT}</pre>
    </details>
  );
}

export default function ExceptionDashboard() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [summary, setSummary] = useState('');
  const [kpis, setKpis] = useState({});
  const [rows, setRows] = useState([]);
  const [warning, setWarning] = useState(undefined);
  const [dataReady, setDataReady] = useState(false);
  const [filterType, setFilterType] = useState('all');
  const [filterSeverity, setFilterSeverity] = useState('all');

  const load = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const data = await fetchExceptionDashboard();
      setSummary(data.summary || '');
      setKpis(data.kpis && typeof data.kpis === 'object' ? data.kpis : {});
      setRows(Array.isArray(data.rows) ? data.rows.map(normalizeRow) : []);
      setWarning(data.warning);
      setDataReady(true);
    } catch (e) {
      setError(e?.message || 'Failed to load exceptions');
    } finally {
      setLoading(false);
    }
  }, []);

  const exceptionTypes = useMemo(() => {
    const fromKpis = KPI_ORDER.filter((k) => k in kpis);
    const fromRows = [...new Set(rows.map((r) => r.exception_type))].filter(Boolean);
    const merged = [...new Set([...fromKpis, ...fromRows])];
    merged.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
    return merged;
  }, [kpis, rows]);

  const filteredRows = useMemo(() => {
    return rows.filter((r) => {
      if (filterType !== 'all' && r.exception_type !== filterType) return false;
      if (filterSeverity !== 'all' && r.severity !== filterSeverity) return false;
      return true;
    });
  }, [rows, filterType, filterSeverity]);

  const cards = useMemo(() => {
    return KPI_ORDER.map((label) => ({
      label,
      count: Number(kpis[label]) || 0,
    }));
  }, [kpis]);

  return (
    <section className="card exception-dashboard">
      <div className="card-head">
        <div>
          <h2>Exception dashboard</h2>
          <p className="hint minimal-gap">
            AI-sourced from frePPLe via MCP. Refresh to re-run tools and rebuild exception rows.
          </p>
        </div>
        <button type="button" className="btn primary" onClick={load} disabled={loading}>
          {loading ? 'Loading…' : 'Refresh data'}
        </button>
      </div>

      <ExceptionDashboardPromptPanel />

      {error && <p className="err">{error}</p>}
      {warning && !error && <p className="hint warn-banner">{warning}</p>}

      {loading && rows.length === 0 && !error && (
        <div className="dashboard-loading">
          <div className="loading-bar" />
          <p className="hint">Querying frePPLe MCP tools and applying exception rules…</p>
        </div>
      )}

      {!loading && !error && !dataReady && (
        <p className="hint">Click &ldquo;Refresh data&rdquo; to load the exception dashboard.</p>
      )}

      {summary ? (
        <p className="exception-summary">{summary}</p>
      ) : null}

      {dataReady ? (
        <div className="exception-cards">
          {cards.map(({ label, count }) => (
            <div key={label} className="exception-card">
              <div className="exception-card-count">{count}</div>
              <div className="exception-card-label">{label}</div>
            </div>
          ))}
        </div>
      ) : null}

      {dataReady && (
        <>
          <div className="exception-filters">
            <label className="field inline">
              <span>Exception type</span>
              <select value={filterType} onChange={(e) => setFilterType(e.target.value)}>
                <option value="all">All types</option>
                {exceptionTypes.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </label>
            <label className="field inline">
              <span>Severity</span>
              <select value={filterSeverity} onChange={(e) => setFilterSeverity(e.target.value)}>
                <option value="all">All</option>
                <option value="High">High</option>
                <option value="Medium">Medium</option>
                <option value="Low">Low</option>
              </select>
            </label>
            <span className="filter-meta">
              Showing {filteredRows.length} of {rows.length} rows
            </span>
          </div>

          <div className="table-wrap scroll exception-table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Location</th>
                  <th>Exception type</th>
                  <th>Severity</th>
                  <th>Recommended action</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.length === 0 && (
                  <tr>
                    <td colSpan={5} className="empty">
                      No rows match the current filters.
                    </td>
                  </tr>
                )}
                {[...filteredRows]
                  .sort((a, b) => {
                    const ds = (SEVERITY_LEVEL[a.severity] ?? 3) - (SEVERITY_LEVEL[b.severity] ?? 3);
                    if (ds !== 0) return ds;
                    return a.exception_type.localeCompare(b.exception_type, undefined, {
                      sensitivity: 'base',
                    });
                  })
                  .map((row, i) => (
                    <tr key={`${row.item}-${row.location}-${row.exception_type}-${i}`}>
                      <td>{row.item}</td>
                      <td>{row.location}</td>
                      <td>{row.exception_type}</td>
                      <td>
                        <span className={`sev-badge ${severityClass(row.severity)}`}>{row.severity}</span>
                      </td>
                      <td className="action-cell">{row.recommended_action}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}
