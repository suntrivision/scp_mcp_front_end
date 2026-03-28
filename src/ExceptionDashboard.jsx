import { useCallback, useMemo, useState } from 'react';
import { fetchExceptionDashboard, queryFreppleNaturalLanguage } from './tallyService.js';
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

function DynamicResultTable({ rows }) {
  if (!rows?.length) return null;
  const cols = Object.keys(rows[0]);
  return (
    <div className="table-wrap scroll exception-table-wrap">
      <table>
        <thead>
          <tr>
            {cols.map((col) => (
              <th key={col}>{col}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i}>
              {cols.map((col) => (
                <td key={`${i}-${col}`}>{String(row[col] ?? '—')}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function ExceptionDashboard() {
  const [agentTab, setAgentTab] = useState('report');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [summary, setSummary] = useState('');
  const [kpis, setKpis] = useState({});
  const [rows, setRows] = useState([]);
  const [warning, setWarning] = useState(undefined);
  const [dataReady, setDataReady] = useState(false);
  const [filterType, setFilterType] = useState('all');
  const [filterSeverity, setFilterSeverity] = useState('all');

  const [promptText, setPromptText] = useState('');
  const [promptLoading, setPromptLoading] = useState(false);
  const [promptErr, setPromptErr] = useState(null);
  const [promptSummary, setPromptSummary] = useState('');
  const [promptKpis, setPromptKpis] = useState({});
  const [promptRows, setPromptRows] = useState([]);
  const [promptWarning, setPromptWarning] = useState(undefined);
  const [promptIntent, setPromptIntent] = useState('');
  const [promptReady, setPromptReady] = useState(false);

  const loadReport = useCallback(async () => {
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

  const runCustomPrompt = useCallback(async () => {
    const text = promptText.trim();
    if (!text || promptLoading) return;
    setPromptErr(null);
    setPromptLoading(true);
    try {
      const data = await queryFreppleNaturalLanguage({ message: text });
      setPromptSummary(data.summary || '');
      setPromptKpis(data.kpis && typeof data.kpis === 'object' ? data.kpis : {});
      setPromptRows(Array.isArray(data.rows) ? data.rows : []);
      setPromptWarning(data.warning);
      setPromptIntent(data.intent || '');
      setPromptReady(true);
    } catch (e) {
      setPromptErr(e?.message || 'Query failed');
      setPromptReady(false);
    } finally {
      setPromptLoading(false);
    }
  }, [promptText, promptLoading]);

  const loadDefaultPrompt = useCallback(() => {
    setPromptText(EXCEPTION_DASHBOARD_PROMPT);
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

  const reportCards = useMemo(() => {
    return KPI_ORDER.map((label) => ({
      label,
      count: Number(kpis[label]) || 0,
    }));
  }, [kpis]);

  const promptKpiEntries = useMemo(() => Object.entries(promptKpis || {}), [promptKpis]);

  return (
    <section className="card exception-dashboard">
      <div className="card-head exception-agent-head">
        <div>
          <h2>AI Exception Agent</h2>
          <p className="hint minimal-gap">
            AI-sourced from Y3 Supply Chain.
            <br />
            Refresh data
          </p>
        </div>
      </div>

      <div className="exception-agent-tabs" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={agentTab === 'report'}
          className={`btn ${agentTab === 'report' ? 'primary' : ''}`}
          onClick={() => {
            setAgentTab('report');
            void loadReport();
          }}
        >
          Exception Report
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={agentTab === 'prompt'}
          className={`btn ${agentTab === 'prompt' ? 'primary' : ''}`}
          onClick={() => setAgentTab('prompt')}
        >
          Enter prompt
        </button>
      </div>

      {agentTab === 'report' && (
        <>
          <div className="exception-report-toolbar">
            <button type="button" className="btn primary" onClick={loadReport} disabled={loading}>
              {loading ? 'Loading…' : 'Refresh data'}
            </button>
          </div>

          {error && <p className="err">{error}</p>}
          {warning && !error && <p className="hint warn-banner">{warning}</p>}

          {loading && rows.length === 0 && !error && (
            <div className="dashboard-loading">
              <div className="loading-bar" />
              <p className="hint">Querying live data and applying exception rules…</p>
            </div>
          )}

          {!loading && !error && !dataReady && (
            <p className="hint">Click &ldquo;Refresh data&rdquo; to refresh the AI Exception Agent.</p>
          )}

          {summary ? <p className="exception-summary">{summary}</p> : null}

          {dataReady ? (
            <div className="exception-cards">
              {reportCards.map(({ label, count }) => (
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
        </>
      )}

      {agentTab === 'prompt' && (
        <>
          <p className="hint exception-prompt-intro">
            Type or paste a prompt. Use &ldquo;Load default exception prompt&rdquo; for the standard exception report
            instructions, then run or edit before sending.
          </p>
          <div className="exception-prompt-editor">
            <textarea
              className="exception-prompt-textarea"
              value={promptText}
              onChange={(e) => setPromptText(e.target.value)}
              placeholder="Enter your prompt for the planning assistant…"
              rows={12}
              spellCheck={false}
            />
            <div className="exception-prompt-actions">
              <button type="button" className="btn" onClick={loadDefaultPrompt}>
                Load default exception prompt
              </button>
              <button type="button" className="btn primary" onClick={runCustomPrompt} disabled={promptLoading}>
                {promptLoading ? 'Running…' : 'Run prompt'}
              </button>
            </div>
          </div>

          {promptErr && <p className="err">{promptErr}</p>}
          {promptWarning && !promptErr && <p className="hint warn-banner">{promptWarning}</p>}

          {promptReady && !promptErr && (
            <>
              {promptIntent ? (
                <p className="hint">
                  Intent: <code>{promptIntent}</code>
                </p>
              ) : null}
              {promptSummary ? <p className="exception-summary">{promptSummary}</p> : null}
              {promptKpiEntries.length > 0 && (
                <div className="exception-cards">
                  {promptKpiEntries.map(([k, v]) => (
                    <div key={k} className="exception-card">
                      <div className="exception-card-count">{String(v)}</div>
                      <div className="exception-card-label">{k}</div>
                    </div>
                  ))}
                </div>
              )}
              <DynamicResultTable rows={promptRows} />
            </>
          )}
        </>
      )}
    </section>
  );
}
