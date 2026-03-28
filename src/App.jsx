import { useCallback, useState } from 'react';
import { queryFreppleNaturalLanguage } from './tallyService.js';
import ExceptionDashboard from './ExceptionDashboard.jsx';

export default function App() {
  const [view, setView] = useState('frepple');
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [chatErr, setChatErr] = useState(null);
  const [queryResult, setQueryResult] = useState(null);
  const [chatHistory, setChatHistory] = useState([
    {
      role: 'assistant',
      content:
        'Ask me anything about SC Trivision data. Example: "Show top 10 open sales orders by due date."',
    },
  ]);

  const sendFreppleChat = useCallback(async () => {
    const text = chatInput.trim();
    if (!text || chatLoading) return;
    setChatErr(null);
    setChatLoading(true);
    setChatHistory((prev) => [...prev, { role: 'user', content: text }]);
    setChatInput('');
    try {
      const data = await queryFreppleNaturalLanguage({ message: text });
      setQueryResult(data);
    } catch (e) {
      setChatErr(e.message);
      setQueryResult(null);
      setChatHistory((prev) => [
        ...prev,
        { role: 'assistant', content: `I hit an error:\n${e.message}` },
      ]);
    } finally {
      setChatLoading(false);
    }
  }, [chatInput, chatLoading]);

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
        const inputEl = document.querySelector('.chat-input-row input');
        if (inputEl) inputEl.focus();
      }, 0);
    },
    [chatLoading]
  );

  const askQuickPrompt = useCallback(
    async (prompt) => {
      if (chatLoading) return;
      setChatErr(null);
      setChatLoading(true);
      setChatHistory((prev) => [...prev, { role: 'user', content: prompt }]);
      try {
        const data = await queryFreppleNaturalLanguage({ message: prompt });
        setQueryResult(data);
      } catch (e) {
        setChatErr(e.message);
        setQueryResult(null);
        setChatHistory((prev) => [...prev, { role: 'assistant', content: `I hit an error:\n${e.message}` }]);
      } finally {
        setChatLoading(false);
      }
    },
    [chatLoading]
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
        </div>
      </header>

      {view === 'frepple' && (
        <section className="card frepple-page">
        <div className="card-head">
          <h2>SC Trivision conversation</h2>
        </div>
        <p className="hint">
          Ask in natural language. This calls Y3 AI Reporting Agent to get information.
        </p>
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
        {chatErr && <p className="err">{chatErr}</p>}
        <div className="chat-box">
          {chatHistory.map((m, i) => (
            <div key={i} className={`chat-msg ${m.role}`}>
              <div className="chat-role">{m.role === 'user' ? 'You' : 'Assistant'}</div>
              <pre>{m.content}</pre>
            </div>
          ))}
        </div>
        {queryResult && (
          <div className="query-result">
            <p className="hint">
              Intent: <code>{queryResult.intent}</code>
            </p>
            <p className="query-summary">{queryResult.summary}</p>
            {Object.keys(queryResult.kpis || {}).length > 0 && (
              <div className="kpi-wrap">
                {Object.entries(queryResult.kpis).map(([k, v]) => (
                  <span key={k} className="kpi-chip">{`${k}: ${v}`}</span>
                ))}
              </div>
            )}
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
        )}
        <div className="chat-input-row">
          <input
            type="text"
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            placeholder='e.g. Show 10 open demands from input/demand/'
            onKeyDown={(e) => {
              if (e.key === 'Enter') sendFreppleChat();
            }}
          />
          <button type="button" className="btn primary" onClick={sendFreppleChat} disabled={chatLoading}>
            {chatLoading ? 'Thinking…' : 'Send'}
          </button>
        </div>
        </section>
      )}

      {view === 'exceptions' && <ExceptionDashboard />}

      <footer className="footer">
        <p className="footer-copyright">Y3 © 2026</p>
      </footer>
    </div>
  );
}
