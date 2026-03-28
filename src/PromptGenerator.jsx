import { useCallback, useMemo, useState } from 'react';
import {
  DATA_SOURCE_OPTIONS,
  OUTPUT_FORMATS,
  PROMPT_TEMPLATES,
  ROW_LIMITS,
} from './promptGeneratorConfig.js';
import { buildGeneratedPrompt } from './promptGeneratorBuild.js';

/**
 * @param {{ mode: 'reporting' | 'exception', onInsert: (text: string) => void, disabled?: boolean }} props
 */
export default function PromptGenerator({ mode, onInsert, disabled }) {
  const [templateId, setTemplateId] = useState('');
  const [goal, setGoal] = useState('');
  const [sourceIds, setSourceIds] = useState(() => ['demand', 'buffer', 'delivery']);
  const [rowLimit, setRowLimit] = useState('25');
  const [filters, setFilters] = useState('');
  const [outputFormat, setOutputFormat] = useState('structured');
  const [extra, setExtra] = useState('');

  const applyTemplate = useCallback((id) => {
    const t = PROMPT_TEMPLATES.find((x) => x.id === id);
    if (!t) return;
    setGoal(t.goal);
    setSourceIds([...t.sources]);
    setRowLimit(t.rowLimit || '25');
    setFilters(t.filters || '');
    setExtra(t.extra || '');
    setTemplateId(id);
  }, []);

  const toggleSource = useCallback((id) => {
    setSourceIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }, []);

  const generated = useMemo(
    () =>
      buildGeneratedPrompt({
        mode,
        goal,
        sourceIds,
        rowLimit,
        filters,
        outputFormat,
        extra,
      }),
    [mode, goal, sourceIds, rowLimit, filters, outputFormat, extra]
  );

  const handleInsert = useCallback(() => {
    onInsert(generated);
  }, [onInsert, generated]);

  return (
    <details className="prompt-generator">
      <summary className="prompt-generator-summary">Generate a prompt</summary>
      <div className="prompt-generator-body">
        <p className="hint prompt-generator-lead">
          Choose a template, select data sources, and add scope. Insert the generated text into your query, refine it,
          then send to run a complex analysis.
        </p>

        <label className="field">
          <span>Start from template</span>
          <select
            value={templateId}
            onChange={(e) => {
              const v = e.target.value;
              setTemplateId(v);
              if (v) applyTemplate(v);
            }}
            disabled={disabled}
          >
            <option value="">Custom (no template)</option>
            {PROMPT_TEMPLATES.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          <span>Goal / question</span>
          <textarea
            className="prompt-generator-textarea"
            rows={4}
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            placeholder="Describe what you need in plain language (the more specific, the better)."
            disabled={disabled}
          />
        </label>

        <div className="field">
          <span>Data sources</span>
          <div className="prompt-generator-checkboxes">
            {DATA_SOURCE_OPTIONS.map((o) => (
              <label key={o.id} className="prompt-generator-check">
                <input
                  type="checkbox"
                  checked={sourceIds.includes(o.id)}
                  onChange={() => toggleSource(o.id)}
                  disabled={disabled}
                />
                {o.label}
              </label>
            ))}
          </div>
        </div>

        <div className="prompt-generator-row">
          <label className="field inline">
            <span>Row depth</span>
            <select value={rowLimit} onChange={(e) => setRowLimit(e.target.value)} disabled={disabled}>
              {ROW_LIMITS.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.label}
                </option>
              ))}
            </select>
          </label>
          {mode === 'reporting' && (
            <label className="field inline">
              <span>Output style</span>
              <select
                value={outputFormat}
                onChange={(e) => setOutputFormat(e.target.value)}
                disabled={disabled}
              >
                {OUTPUT_FORMATS.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>

        {mode === 'reporting' && (
          <p className="hint small-hint">{OUTPUT_FORMATS.find((o) => o.id === outputFormat)?.hint}</p>
        )}

        <label className="field">
          <span>Scope / filters (optional)</span>
          <textarea
            className="prompt-generator-textarea prompt-generator-textarea-sm"
            rows={2}
            value={filters}
            onChange={(e) => setFilters(e.target.value)}
            placeholder="e.g. location = DC-East, focus on last 30 days, SKU prefix ABC…"
            disabled={disabled}
          />
        </label>

        <label className="field">
          <span>Extra instructions (optional)</span>
          <textarea
            className="prompt-generator-textarea prompt-generator-textarea-sm"
            rows={2}
            value={extra}
            onChange={(e) => setExtra(e.target.value)}
            placeholder="Sorting rules, thresholds, columns to include…"
            disabled={disabled}
          />
        </label>

        <div className="prompt-generator-actions">
          <button type="button" className="btn primary" onClick={handleInsert} disabled={disabled}>
            Insert into query
          </button>
        </div>

        <label className="field">
          <span>Live preview</span>
          <textarea
            className="prompt-generator-textarea prompt-generator-preview"
            readOnly
            rows={12}
            value={generated}
            spellCheck={false}
          />
        </label>
      </div>
    </details>
  );
}
