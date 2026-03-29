import { useCallback, useState } from 'react';
import { queryFreppleNaturalLanguage } from './tallyService.js';
import ExceptionDashboard from './ExceptionDashboard.jsx';
import InventoryShortageReport from './Inventoryshortagereport.jsx';
import PromptGenerator from './PromptGenerator.jsx';
import QueryAgentsPanel from './QueryAgentsPanel.jsx';

export default function App() {
  const [view, setView] = useState('frepple');
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [chatErr, setChatErr] = useState(null);
  const [queryResult, setQueryResult] = useState(null);
  const [lastQuerySent, setLastQuerySent] = useState('');

  const runQueryWithText = useCallback(async (message) => {
    const text = String(message || '').trim();
    if (!text || chatLoading) return;
    setChatErr(null);
    setQueryResult(null);
    setLastQuerySent('');
    setChatLoading(true);
    setChatInput('');
    try {
      const data = await queryFreppleNaturalLanguage({ message: text });
      setQueryResult(data);
      setLastQuerySent(text);
    } catch (e) {
      setChatErr(e.message);
      setQueryResult(null);
    } finally {
      setChatLoading(false);
    }
  }, [chatLoading]);

  const sendFreppleChat = useCallback(async () => {
    const text = chatInput.trim();
    if (!text || chatLoading) return;
    await runQueryWithText(text);
  }, [chatInput, chatLoading, runQueryWithText]);

  const quickPrompts = [
    'Show 10 open sales orders from input/demand/ with due date and delay.',
    'List top 10 delayed demands from input/demand/ sorted by delay descending.',
    'Show 15 items from input/item/ with category and cost.',
    'List 15 customers from input/customer/ with source and lastmodified.',
    'Show 10 delivery orders from input/deliveryorder/ with status.',
  ];

  const sendPrompt = useCallback(
    async (prompt) => {
      if (chatLoading) return;
      setChatInput(prompt);
      setTimeout(() => {
        setChatInput(prompt);
      }, 0);
      setTimeout(() => {
        const inputEl = document.querySelector('.reporting-query-input');
        if (inputEl) inputEl.focus();
      }, 0);
    },
    [chatLoading]
  );

  const askQuickPrompt = useCallback(
    async (prompt) => {
      if (chatLoading) return;
      await runQueryWithText(prompt);
    },
    [chatLoading, runQueryWithText]
  );

  return (
    <div className="app">
      <header className="header">
        <div className="header-brand">
          <img className="header-logo" src="/y3-logo.png" alt="Y3" />
          <p className="sub">Conversational analytics and exception planning</p>
        </div>
        <div className="toolbar page-switch">
          <button
            type="button"
            className={`btn ${view === 'frepple' ? 'primary' : ''}`}
            onClick={() => setView('frepple')}
          >
            AI Reporting Agent
          </button>
          <button
            type="button"
            className={`btn ${view === 'exceptions' ? 'primary' : ''}`}
            onClick={() => setView('exceptions')}
          >
            AI Exception Agent
          </button>
          <button
            type="button"
            className={`btn ${view === 'inventory' ? 'primary' : ''}`}
            onClick={() => setView('inventory')}
          >
            Inventory Shortage
          </button>
        </div>
      </header>

      {view === 'frepple' && (
        <section className="card frepple-page">
        <div className="card-head">
          <h2>Y3 Agentic Conversation</h2>
        </div>
        <p className="hint">
          Ask in natural language. This calls Y3 AI Reporting Agent to get information. Use{' '}
          <strong>Generate a prompt</strong> below for multi-step or cross-domain questions.
        </p>
        <PromptGenerator mode="reporting" onInsert={setChatInput} disabled={chatLoading} />
        <QueryAgentsPanel
          context="reporting"
          currentQuery={chatInput}
          disabled={chatLoading}
          onApplyQuery={setChatInput}
          onRunQuery={runQueryWithText}
        />
        <div className="quick-prompts">
          {quickPrompts.map((p) => (
            <button
              type="button"
              key={p}
              className="btn quick"
              onClick={() => askQuickPrompt(p)}
              onDoubleClick={() => sendPrompt(p)}
              disabled={chatLoading}
              title="Click to run now. Double-click to copy into input."
            >
              {p}
            </button>
          ))}
        </div>
        <div className="reporting-compose">
          <label className="field reporting-query-label">
            <span>Your query</span>
            <div className="chat-input-row reporting-input-row">
              <textarea
                className="reporting-query-input"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="Type a question or insert a generated prompt. Use Ctrl+Enter to send."
                rows={5}
                disabled={chatLoading}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                    e.preventDefault();
                    sendFreppleChat();
                  }
                }}
              />
              <button type="button" className="btn primary" onClick={sendFreppleChat} disabled={chatLoading}>
                {chatLoading ? 'Thinking…' : 'Send'}
              </button>
            </div>
          </label>
        </div>
        {chatErr && <p className="err">{chatErr}</p>}
        {chatLoading && !queryResult && !chatErr && (
          <p className="hint reporting-loading">Working on your request…</p>
        )}
        {queryResult && (() => {
          const narrativeText =
            String(queryResult.narrative || '').trim() || String(queryResult.summary || '').trim();
          const recs = Array.isArray(queryResult.recommendations)
            ? queryResult.recommendations.filter((x) => String(x || '').trim())
            : [];
          return (
            <div className="query-result">
              <p className="hint">
                Intent: <code>{queryResult.intent}</code>
              </p>
              {queryResult.intent === 'general_query' && lastQuerySent ? (
                <p className="query-sent">
                  <span className="query-sent-label">Query sent:</span>
                  <span className="query-sent-body">{lastQuerySent}</span>
                </p>
              ) : null}
              {Object.keys(queryResult.kpis || {}).length > 0 && (
                <div className="kpi-wrap">
                  {Object.entries(queryResult.kpis).map(([k, v]) => (
                    <span key={k} className="kpi-chip">{`${k}: ${v}`}</span>
                  ))}
                </div>
              )}
              {narrativeText ? <p className="query-narrative-main">{narrativeText}</p> : null}
              {recs.length > 0 ? (
                <ul className="query-recommendations">
                  {recs.map((item, i) => (
                    <li key={i}>{String(item)}</li>
                  ))}
                </ul>
              ) : null}
              {queryResult.rows?.length > 0 && (
                <div className="table-wrap result-table">
                  <table>
                    <thead>
                      <tr>
                        {Object.keys(queryResult.rows[0]).map((col) => (
                          <th key={col}>{col}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {queryResult.rows.map((row, i) => (
                        <tr key={i}>
                          {Object.keys(queryResult.rows[0]).map((col) => (
                            <td key={`${i}-${col}`}>{String(row[col] ?? '—')}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          );
        })()}
        </section>
      )}

      {view === 'exceptions' && <ExceptionDashboard />}

      {view === 'inventory' && (
        <section className="card inventory-shortage-page">
          <InventoryShortageReport />
        </section>
      )}

      <footer className="footer">
        <p className="footer-copyright">Y3 © 2026</p>
      </footer>
    </div>
  );
}
