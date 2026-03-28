const STORAGE_KEY = 'y3-query-agents-v1';

function readAll() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeAll(agents) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(agents));
}

function newId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return `agent-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * @param {'reporting' | 'exception'} context
 */
export function listAgentsLocal(context) {
  return readAll()
    .filter((a) => a.context === context)
    .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
}

/**
 * @param {{ name: string, body: string, context: 'reporting' | 'exception' }} data
 */
export function createAgentLocal(data) {
  const name = String(data.name || '').trim();
  const body = String(data.body || '').trim();
  if (!name) throw new Error('Name is required');
  if (!body) throw new Error('Query text is required');
  const agents = readAll();
  const now = Date.now();
  const agent = {
    id: newId(),
    name,
    body,
    context: data.context,
    createdAt: now,
    updatedAt: now,
  };
  agents.push(agent);
  writeAll(agents);
  return agent;
}

/**
 * @param {string} id
 * @param {{ name?: string, body?: string }} patch
 */
export function updateAgentLocal(id, patch) {
  const agents = readAll();
  const i = agents.findIndex((a) => a.id === id);
  if (i < 0) throw new Error('Agent not found');
  const cur = agents[i];
  const name = patch.name !== undefined ? String(patch.name).trim() : cur.name;
  const body = patch.body !== undefined ? String(patch.body).trim() : cur.body;
  if (!name) throw new Error('Name is required');
  if (!body) throw new Error('Query text is required');
  agents[i] = {
    ...cur,
    name,
    body,
    updatedAt: Date.now(),
  };
  writeAll(agents);
  return agents[i];
}

/** @param {string} id */
export function deleteAgentLocal(id) {
  writeAll(readAll().filter((a) => a.id !== id));
}
