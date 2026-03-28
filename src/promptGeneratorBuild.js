import { DATA_SOURCE_OPTIONS } from './promptGeneratorConfig.js';

function labelForSource(id) {
  return DATA_SOURCE_OPTIONS.find((o) => o.id === id)?.label ?? id;
}

/**
 * @param {{
 *   mode: 'reporting' | 'exception',
 *   goal: string,
 *   sourceIds: string[],
 *   rowLimit: string,
 *   filters: string,
 *   outputFormat: string,
 *   extra: string,
 * }} p
 */
export function buildGeneratedPrompt(p) {
  const goal = String(p.goal || '').trim() || 'Answer the planning question using live data.';
  const sources = (p.sourceIds || []).map(labelForSource).filter(Boolean);
  const sourcesBlock =
    sources.length > 0
      ? sources.map((s) => `- ${s}`).join('\n')
      : '- Use the most relevant Y3 MCP resources for the goal.';

  const limit = p.rowLimit ? `Cap detailed lists at roughly ${p.rowLimit} rows (fewer if sparse).` : '';
  const filters = String(p.filters || '').trim();
  const filtersBlock = filters ? `Scope / filters:\n${filters}\n` : '';
  const extra = String(p.extra || '').trim();

  const outputReporting =
    p.outputFormat === 'table'
      ? 'Return a short narrative plus a compact markdown table for tabular lists.'
      : p.outputFormat === 'deep'
        ? 'Return structured reasoning: findings, evidence from data, assumptions, caveats, and suggested next actions.'
        : 'Return JSON only with keys: intent, summary, kpis (object), rows (array of objects). No markdown fences.';

  const outputException = `Return JSON only (no markdown) with keys: intent, summary, kpis (counts by category), rows (array of objects with item, location, root_cause_category, exception_type, severity High|Medium|Low, recommended_action, detail).`;

  if (p.mode === 'exception') {
    return `You are a Y3 Exception Analyst. Use MCP tools only with live data.

Objective:
${goal}

Query these areas as needed:
${sourcesBlock}

${limit}
${filtersBlock}
${outputException}

${extra ? `Additional instructions:\n${extra}` : ''}`.trim();
  }

  return `You are a Y3 Planning Assistant. Use only Y3 MCP tools. Prefer paths such as input/demand/, forecast/forecastplan/, input/buffer/, input/deliveryorder/, input/distributionorder/, input/item/, input/customer/.

Task:
${goal}

Data sources to consult:
${sourcesBlock}

${limit}
${filtersBlock}
Output requirements:
${outputReporting}

${extra ? `Additional instructions:\n${extra}` : ''}`.trim();
}
