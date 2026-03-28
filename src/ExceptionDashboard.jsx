import { useCallback, useMemo, useState } from 'react';
import { fetchExceptionDashboard, queryFreppleNaturalLanguage } from './tallyService.js';
import { EXCEPTION_DASHBOARD_PROMPT } from './freppleExceptionDashboardPrompt.js';
import { DEMO_EXCEPTION_RESPONSE } from './exceptionDemoData.js';

const SEVERITY_LEVEL = { High: 0, Medium: 1, Low: 2 };

function normalizeRow(raw) {
  const item =
    raw.item ?? raw.Item ?? raw.item_id ?? raw['Item'] ?? '—';
  const location =
    raw.location ?? raw.Location ?? raw.location_id ?? '—';
  const rootCause =
    raw.root_cause_category ??
    raw.rootCauseCategory ??
    raw['Root cause category'] ??
    raw.exception_type ??
    raw.exceptionType ??
    raw['Exception Type'] ??
    '—';
  const exceptionType =
    raw.exception_type ??
    raw.exceptionType ??
    raw['Exception Type'] ??
    String(rootCause);
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
  const detail =
    raw.detail ?? raw.explanation ?? raw.notes ?? raw['Root cause detail'] ?? '';
  return {
    item: String(item),
    location: String(location),
    root_cause_category: String(rootCause),
    exception_type: String(exceptionType),
    severity,
    recommended_action: String(recommendedAction),
    detail: String(detail),
  };
}

function rowCategory(row) {
  const rc = row.root_cause_category;
  if (rc && rc !== '—') return rc;
  return row.exception_type || '—';
}

function severityClass(sev) {
  if (sev === 'High') return 'sev-high';
  if (sev === 'Medium') return 'sev-medium';
  return 'sev-low';
}

function shouldUseDemo(err) {
  const msg = String(err?.message || '');
  return /not configured|FREPPLE|502|503|504|Network|fetch|reach|failed to fetch|ECONNREFUSED|Unable to connect/i.test(
    msg
  );
}

function sortRows(a, b) {
  const ds = (SEVERITY_LEVEL[a.severity] ?? 3) - (SEVERITY_LEVEL[b.severity] ?? 3);
  if (ds !== 0) return ds;
  return rowCategory(a).localeCompare(rowCategory(b), undefined, { sensitivity: 'base' });
}

function ExpandableExceptionList({ rows }) {
  const sorted = useMemo(() => [...rows].sort(sortRows), [rows]);
  if (!sorted.length) {
    return (
      <p className="hint">
        No rows match the current filters.
      </p>
    );
  }
  return (
    <div className="exception-expand-list">
      {sorted.map((row, i) => (
        <details key={`${row.item}-${row.location}-${rowCategory(row)}-${i}`} className="exception-expand-card">
          <summary className="exception-expand-summary">
            <span className={`sev-badge ${severityClass(row.severity)}`}>{row.severity}</span>
            <span className="rc-chip">{rowCategory(row)}</span>
            <span className="rc-item">{row.item}</span>
            <span className="rc-loc">{row.location}</span>
          </summary>
          <div className="exception-expand-body">
            <p>
              <strong>Recommended action</strong>
              <br />
              {row.recommended_action}
            </p>
            {row.detail ? (
              <p>
                <strong>Detail</strong>
                <br />
                {row.detail}
              </p>
            ) : null}
          </div>
        </details>
      ))}
    </div>
  );
}

function DynamicKpiCards({ kpis }) {
  const entries = useMemo(() => {
    return Object.entries(kpis || {}).sort(([a], [b]) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
  }, [kpis]);
  if (!entries.length) return null;
  return (
    <div className="exception-cards">
      {entries.map(([label, count]) => (
        <div key={label} className="exception-card">
          <div className="exception-card-count">{Number(count) || 0}</div>
          <div className="exception-card-label">{label}</div>
        </div>
      ))}
    </div>
  );
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
  const [filterCategory, setFilterCategory] = useState('all');
  const [filterSeverity, setFilterSeverity] = useState('all');
  const [isDemo, setIsDemo] = useState(false);

  const [promptText, setPromptText] = useState('');
  const [promptLoading, setPromptLoading] = useState(false);
  const [promptErr, setPromptErr] = useState(null);
  const [promptSummary, setPromptSummary] = useState('');
  const [promptKpis, setPromptKpis] = useState({});
  const [promptRows, setPromptRows] = useState([]);
  const [promptRowsRaw, setPromptRowsRaw] = useState([]);
  const [promptWarning, setPromptWarning] = useState(undefined);
  const [promptIntent, setPromptIntent] = useState('');
  const [promptReady, setPromptReady] = useState(false);
  const [promptFilterCategory, setPromptFilterCategory] = useState('all');
  const [promptFilterSeverity, setPromptFilterSeverity] = useState('all');
  const [promptUseStructuredLayout, setPromptUseStructuredLayout] = useState(true);

  const applyDemo = useCallback(() => {
    setSummary(DEMO_EXCEPTION_RESPONSE.summary);
    setKpis(DEMO_EXCEPTION_RESPONSE.kpis);
    setRows(DEMO_EXCEPTION_RESPONSE.rows.map(normalizeRow));
    setWarning(undefined);
    setDataReady(true);
    setIsDemo(true);
    setError(null);
  }, []);

  const loadReport = useCallback(async () => {
    setError(null);
    setIsDemo(false);
    setLoading(true);
    try {
      const data = await fetchExceptionDashboard();
      setSummary(data.summary || '');
      setKpis(data.kpis && typeof data.kpis === 'object' ? data.kpis : {});
      setRows(Array.isArray(data.rows) ? data.rows.map(normalizeRow) : []);
      setWarning(data.warning);
      setDataReady(true);
    } catch (e) {
      if (shouldUseDemo(e)) {
        applyDemo();
      } else {
        setError(e?.message || 'Failed to load exceptions');
        setDataReady(false);
      }
    } finally {
      setLoading(false);
    }
  }, [applyDemo]);

  const runCustomPrompt = useCallback(async () => {
    const text = promptText.trim();
    if (!text || promptLoading) return;
    setPromptErr(null);
    setPromptLoading(true);
    setPromptReady(false);
    try {
      const data = await queryFreppleNaturalLanguage({ message: text });
      setPromptSummary(data.summary || '');
      setPromptKpis(data.kpis && typeof data.kpis === 'object' ? data.kpis : {});
      const raw = Array.isArray(data.rows) ? data.rows : [];
      setPromptRowsRaw(raw);
      const normalized = raw.map(normalizeRow);
      setPromptRows(normalized);
      const hasStructure =
        normalized.length > 0 &&
        normalized.some(
          (r) =>
            (r.root_cause_category && r.root_cause_category !== '—') ||
            (r.recommended_action && r.recommended_action !== '—')
        );
      setPromptUseStructuredLayout(hasStructure);
      setPromptWarning(data.warning);
      setPromptIntent(data.intent || '');
      setPromptReady(true);
      setPromptFilterCategory('all');
      setPromptFilterSeverity('all');
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

  const categoryOptions = useMemo(() => {
    const fromKpis = Object.keys(kpis);
    const fromRows = [...new Set(rows.map((r) => rowCategory(r)))].filter((x) => x && x !== '—');
    const merged = [...new Set([...fromKpis, ...fromRows])];
    merged.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
    return merged;
  }, [kpis, rows]);

  const filteredRows = useMemo(() => {
    return rows.filter((r) => {
      const cat = rowCategory(r);
      if (filterCategory !== 'all' && cat !== filterCategory) return false;
      if (filterSeverity !== 'all' && r.severity !== filterSeverity) return false;
      return true;
    });
  }, [rows, filterCategory, filterSeverity]);

  const promptCategoryOptions = useMemo(() => {
    const fromKpis = Object.keys(promptKpis || {});
    const fromRows = [...new Set(promptRows.map((r) => rowCategory(r)))].filter((x) => x && x !== '—');
    const merged = [...new Set([...fromKpis, ...fromRows])];
    merged.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
    return merged;
  }, [promptKpis, promptRows]);

  const promptFilteredRows = useMemo(() => {
    return promptRows.filter((r) => {
      const cat = rowCategory(r);
      if (promptFilterCategory !== 'all' && cat !== promptFilterCategory) return false;
      if (promptFilterSeverity !== 'all' && r.severity !== promptFilterSeverity) return false;
      return true;
    });
  }, [promptRows, promptFilterCategory, promptFilterSeverity]);

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

          {isDemo && (
            <div className="demo-banner" role="status">
              Showing <strong>demo sample data</strong> because the live backend could not be reached or is not
              configured. Set <code>FREPPLE_BACKEND_URL</code> on the server and redeploy to use live frePPLe data.
            </div>
          )}

          {error && !isDemo && <p className="err">{error}</p>}
          {warning && !error && !isDemo && <p className="hint warn-banner">{warning}</p>}

          {loading && rows.length === 0 && !error && !isDemo && (
            <div className="dashboard-loading">
              <div className="loading-bar" />
              <p className="hint">Querying live data and applying exception rules…</p>
            </div>
          )}

          {!loading && !error && !dataReady && !isDemo && (
            <p className="hint">Click &ldquo;Refresh data&rdquo; or open the Exception Report tab to load data.</p>
          )}

          {summary ? <p className="exception-summary">{summary}</p> : null}

          {dataReady ? <DynamicKpiCards kpis={kpis} /> : null}

          {dataReady && (
            <>
              <div className="exception-filters">
                <label className="field inline">
                  <span>Root cause category</span>
                  <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)}>
                    <option value="all">All categories</option>
                    {categoryOptions.map((t) => (
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

              <ExpandableExceptionList rows={filteredRows} />
            </>
          )}
        </>
      )}

      {agentTab === 'prompt' && (
        <>
          <p className="hint exception-prompt-intro">
            Type or paste a prompt. Use &ldquo;Load default exception prompt&rdquo; for the standard exception report
            instructions, then run or edit before sending. The dashboard below updates from the JSON returned (KPIs,
            filters, expandable cards).
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

          {promptErr && (
            <p className="err" role="alert">
              {promptErr}
            </p>
          )}
          {promptWarning && !promptErr && <p className="hint warn-banner">{promptWarning}</p>}

          {promptReady && !promptErr && (
            <>
              {promptIntent ? (
                <p className="hint">
                  Intent: <code>{promptIntent}</code>
                </p>
              ) : null}
              {promptSummary ? <p className="exception-summary">{promptSummary}</p> : null}
              {Object.keys(promptKpis || {}).length > 0 ? <DynamicKpiCards kpis={promptKpis} /> : null}

              {promptRows.length > 0 && (
                <div className="exception-filters">
                  <label className="field inline">
                    <span>Root cause category</span>
                    <select
                      value={promptFilterCategory}
                      onChange={(e) => setPromptFilterCategory(e.target.value)}
                    >
                      <option value="all">All categories</option>
                      {promptCategoryOptions.map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="field inline">
                    <span>Severity</span>
                    <select
                      value={promptFilterSeverity}
                      onChange={(e) => setPromptFilterSeverity(e.target.value)}
                    >
                      <option value="all">All</option>
                      <option value="High">High</option>
                      <option value="Medium">Medium</option>
                      <option value="Low">Low</option>
                    </select>
                  </label>
                  <span className="filter-meta">
                    Showing {promptFilteredRows.length} of {promptRows.length} rows
                  </span>
                </div>
              )}

              {promptUseStructuredLayout && promptRows.length > 0 ? (
                <ExpandableExceptionList rows={promptFilteredRows} />
              ) : (
                <DynamicResultTable rows={promptRowsRaw} />
              )}
            </>
          )}
        </>
      )}
    </section>
  );
}
