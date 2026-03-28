import {
  createAgentLocal,
  deleteAgentLocal,
  listAgentsLocal,
  updateAgentLocal,
} from './queryAgentsLocal.js';
import { isSupabaseConfigured, supabase } from './supabaseClient.js';

/** @param {import('@supabase/supabase-js').PostgrestSingleResponse<any>} res */
function throwIfError(res) {
  if (res.error) throw new Error(res.error.message || 'Database error');
}

function mapRow(row) {
  return {
    id: row.id,
    name: row.name,
    body: row.body,
    context: row.context,
    createdAt: row.created_at ? new Date(row.created_at).getTime() : Date.now(),
    updatedAt: row.updated_at ? new Date(row.updated_at).getTime() : Date.now(),
  };
}

/**
 * @param {'reporting' | 'exception'} context
 * @returns {Promise<Array<{ id: string, name: string, body: string, context: string, createdAt: number, updatedAt: number }>>}
 */
export async function listAgents(context) {
  if (!isSupabaseConfigured() || !supabase) {
    return listAgentsLocal(context);
  }
  const res = await supabase
    .from('query_agents')
    .select('*')
    .eq('context', context)
    .order('updated_at', { ascending: false });
  throwIfError(res);
  return (res.data || []).map(mapRow);
}

/**
 * @param {{ name: string, body: string, context: 'reporting' | 'exception' }} data
 */
export async function createAgent(data) {
  const name = String(data.name || '').trim();
  const body = String(data.body || '').trim();
  if (!name) throw new Error('Name is required');
  if (!body) throw new Error('Query text is required');

  if (!isSupabaseConfigured() || !supabase) {
    return createAgentLocal(data);
  }
  const res = await supabase
    .from('query_agents')
    .insert({ name, body, context: data.context })
    .select('*')
    .single();
  throwIfError(res);
  return mapRow(res.data);
}

/**
 * @param {string} id
 * @param {{ name?: string, body?: string }} patch
 */
export async function updateAgent(id, patch) {
  if (!isSupabaseConfigured() || !supabase) {
    return updateAgentLocal(id, patch);
  }
  const row = {};
  if (patch.name !== undefined) row.name = String(patch.name).trim();
  if (patch.body !== undefined) row.body = String(patch.body).trim();
  if (row.name === '') throw new Error('Name is required');
  if (row.body === '') throw new Error('Query text is required');
  row.updated_at = new Date().toISOString();

  const res = await supabase.from('query_agents').update(row).eq('id', id).select('*').single();
  throwIfError(res);
  return mapRow(res.data);
}

/** @param {string} id */
export async function deleteAgent(id) {
  if (!isSupabaseConfigured() || !supabase) {
    deleteAgentLocal(id);
    return;
  }
  const res = await supabase.from('query_agents').delete().eq('id', id);
  throwIfError(res);
}
