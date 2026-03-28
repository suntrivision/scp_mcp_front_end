import { useCallback, useEffect, useState } from 'react';
import {
  createAgent,
  deleteAgent,
  listAgents,
  updateAgent,
} from './queryAgentsApi.js';

function snippet(text, max = 120) {
  const t = String(text || '').replace(/\s+/g, ' ').trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max)}…`;
}

/**
 * @param {{
 *   context: 'reporting' | 'exception',
 *   currentQuery: string,
 *   disabled?: boolean,
 *   onApplyQuery: (body: string) => void,
 *   onRunQuery?: (body: string) => void | Promise<void>,
 * }} props
 */
export default function QueryAgentsPanel({ context, currentQuery, disabled, onApplyQuery, onRunQuery }) {
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadErr, setLoadErr] = useState(null);
  const [modal, setModal] = useState(null);
  const [formName, setFormName] = useState('');
  const [formBody, setFormBody] = useState('');

  const refresh = useCallback(async () => {
    setLoading(true);
    setLoadErr(null);
    try {
      const list = await listAgents(context);
      setAgents(list);
    } catch (e) {
      setLoadErr(e?.message || 'Could not load agents');
      setAgents([]);
    } finally {
      setLoading(false);
    }
  }, [context]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const openCreate = useCallback(() => {
    setFormName('');
    setFormBody('');
    setModal('create');
  }, []);

  const openEdit = useCallback((a) => {
    setFormName(a.name);
    setFormBody(a.body);
    setModal({ mode: 'edit', id: a.id });
  }, []);

  const closeModal = useCallback(() => {
    setModal(null);
    setFormName('');
    setFormBody('');
  }, []);

  const handleSave = useCallback(async () => {
    try {
      if (modal === 'create') {
        await createAgent({ name: formName, body: formBody, context });
      } else if (modal?.mode === 'edit') {
        await updateAgent(modal.id, { name: formName, body: formBody });
      }
      await refresh();
      closeModal();
    } catch (e) {
      alert(e?.message || 'Could not save');
    }
  }, [modal, formName, formBody, context, refresh, closeModal]);

  const handleDelete = useCallback(
    async (id) => {
      if (!window.confirm('Delete this query agent?')) return;
      try {
        await deleteAgent(id);
        await refresh();
      } catch (e) {
        alert(e?.message || 'Could not delete');
      }
    },
    [refresh]
  );

  const title = 'Create Agents';

  return (
    <div className="query-agents">
      <div className="query-agents-head">
        <h3 className="query-agents-title">{title}</h3>
        <div className="query-agents-toolbar">
          <button type="button" className="btn primary" onClick={openCreate} disabled={disabled}>
            New agent
          </button>
          <button
            type="button"
            className="btn"
            onClick={() => {
              setFormName('');
              setFormBody(currentQuery?.trim() || '');
              setModal('create');
            }}
            disabled={disabled || !String(currentQuery || '').trim()}
            title="Save the current query text as an agent"
          >
            Save Agent
          </button>
        </div>
      </div>

      {loadErr && <p className="err query-agents-err">{loadErr}</p>}

      {loading ? (
        <p className="hint query-agents-empty">Loading agents…</p>
      ) : agents.length === 0 ? (
        <p className="hint query-agents-empty">No saved agents yet. Create one or use Save Agent with text in the query box.</p>
      ) : (
        <ul className="query-agents-list">
          {agents.map((a) => (
            <li key={a.id} className="query-agents-card">
              <div className="query-agents-card-main">
                <div className="query-agents-card-title">{a.name}</div>
                <p className="query-agents-card-snippet">{snippet(a.body)}</p>
                <p className="query-agents-card-meta">
                  Updated {new Date(a.updatedAt || a.createdAt).toLocaleString()}
                </p>
              </div>
              <div className="query-agents-card-actions">
                <button
                  type="button"
                  className="btn"
                  onClick={() => onApplyQuery(a.body)}
                  disabled={disabled}
                >
                  Load
                </button>
                {onRunQuery ? (
                  <button
                    type="button"
                    className="btn primary"
                    onClick={() => onRunQuery(a.body)}
                    disabled={disabled}
                  >
                    Run
                  </button>
                ) : null}
                <button type="button" className="btn" onClick={() => openEdit(a)} disabled={disabled}>
                  Edit
                </button>
                <button type="button" className="btn" onClick={() => handleDelete(a.id)} disabled={disabled}>
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {modal ? (
        <div className="query-agents-modal-backdrop" role="presentation" onClick={closeModal}>
          <div
            className="query-agents-modal"
            role="dialog"
            aria-labelledby="query-agent-modal-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h4 id="query-agent-modal-title" className="query-agents-modal-heading">
              {modal === 'create' ? 'New query agent' : 'Edit query agent'}
            </h4>
            <label className="field">
              <span>Name</span>
              <input
                type="text"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="e.g. Weekly demand health check"
                autoFocus
              />
            </label>
            <label className="field">
              <span>Query / prompt</span>
              <textarea
                className="query-agents-modal-textarea"
                rows={12}
                value={formBody}
                onChange={(e) => setFormBody(e.target.value)}
                spellCheck={false}
              />
            </label>
            <div className="query-agents-modal-actions">
              <button type="button" className="btn" onClick={closeModal}>
                Cancel
              </button>
              <button type="button" className="btn primary" onClick={handleSave}>
                Save
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
