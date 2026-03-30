import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawn } from 'node:child_process';
import { proxyAnthropicMessages } from './anthropic-proxy.mjs';
import { FREPPLE_INVENTORY_SHORTAGE_PROMPT } from './frepple-inventory-shortage-prompt.mjs';

const PORT = Number(process.env.PORT || 8787);
const MCP_ROOT = process.env.TALLY_MCP_ROOT || 'C:\\mcp\\tally-prime';
const CLAUDE_WORKDIR = process.env.CLAUDE_WORKDIR || 'C:\\claudeagents';

/** Node services often lack PATH entries for Claude Code; prefer a real .exe. */
function resolveClaudeExecutable() {
  const fromEnv = process.env.CLAUDE_EXE;
  if (fromEnv && fs.existsSync(fromEnv)) return fromEnv;
  const home = process.env.USERPROFILE || process.env.HOME || '';
  const win = path.join(home, '.local', 'bin', 'claude.exe');
  if (fs.existsSync(win)) return win;
  const posix = path.join(home, '.local', 'bin', 'claude');
  if (fs.existsSync(posix)) return posix;
  return 'claude';
}

function runClaudePrintMode(claudeBin, args, cwd, timeoutMs) {
  return new Promise((resolve, reject) => {
    const child = spawn(claudeBin, args, {
      cwd,
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env },
    });
    let stdout = '';
    let stderr = '';
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (d) => {
      stdout += d;
    });
    child.stderr.on('data', (d) => {
      stderr += d;
    });
    const t = setTimeout(() => {
      child.kill('SIGTERM');
      reject(new Error('Claude command timed out'));
    }, timeoutMs);
    child.on('error', (e) => {
      clearTimeout(t);
      reject(e);
    });
    child.on('close', (code) => {
      clearTimeout(t);
      resolve({ code, stdout, stderr });
    });
  });
}

function detectIntent(message) {
  const lower = message.toLowerCase();
  if (/(late|delayed|overdue).*(order|demand)|\blate orders?\b/.test(lower)) {
    return 'late_orders';
  }
  if (/fulfill|availability|available|can we ship|can we fulfill/.test(lower)) {
    return 'availability_check';
  }
  if (/bottleneck|capacity|constraint|workcenter|work center/.test(lower)) {
    return 'bottleneck_analysis';
  }
  return 'general_query';
}

/** Strip ```json ... ``` wrappers some models add around JSON. */
function stripMarkdownFences(text) {
  let t = String(text || '').trim();
  if (t.startsWith('```')) {
    const firstNl = t.indexOf('\n');
    if (firstNl > 0) t = t.slice(firstNl + 1);
    const endFence = t.lastIndexOf('```');
    if (endFence > 0) t = t.slice(0, endFence).trim();
  }
  return t;
}

/** Main explanatory text only (`recommendations` is handled separately). */
function extractNarrative(parsed) {
  if (!parsed || typeof parsed !== 'object') return '';
  const keys = ['narrative', 'Narrative', 'analysis', 'commentary', 'explanation'];
  for (const k of keys) {
    const v = parsed[k];
    if (typeof v === 'string' && v.trim()) return v.trim();
  }
  return '';
}

/** Normalize `recommendations` to an array of strings for the UI bullet list. */
function normalizeRecommendations(parsed) {
  if (!parsed || typeof parsed !== 'object') return [];
  const r = parsed.recommendations;
  if (Array.isArray(r)) {
    return r
      .map((x) =>
        typeof x === 'string' ? x.trim() : typeof x === 'number' ? String(x) : ''
      )
      .filter(Boolean);
  }
  if (typeof r === 'string' && r.trim()) {
    return r
      .split(/\n+/)
      .map((s) => s.replace(/^[-*•]\s*/, '').trim())
      .filter(Boolean);
  }
  return [];
}

function buildFreppleStructuredPrompt({ message, intent }) {
  const isExceptionDashboard =
    /exception_dashboard|"intent":\s*"exception_dashboard"|Build an exception dashboard/i.test(message);
  const persona = isExceptionDashboard
    ? 'You are a Y3 Exception Analyst.'
    : 'You are a Y3 Planning Assistant.';
  return [
    persona,
    'Use only Y3 MCP tools to answer the user question.',
    'Respond as JSON only. No markdown fences. No extra text.',
    'When listing rows, cap at 80 rows (prioritize highest-severity exceptions first).',
    'Preferred paths include: input/demand/, input/item/, input/customer/, input/location/, input/deliveryorder/.',
    'If data is missing, still return valid JSON with an explanation in summary.',
    '',
    'JSON schema:',
    '{',
    '  "intent": "late_orders|availability_check|bottleneck_analysis|general_query",',
    '  "summary": "brief headline (optional if narrative covers it)",',
    '  "kpis": { "key": "number or string" },',
    '  "narrative": "required: main explanatory paragraph in plain conversational language — what the data shows and why it matters.",',
    '  "recommendations": ["short actionable item 1", "item 2", "..."],',
    '  "rows": [ { "column": "value" } ]',
    '}',
    '',
    `Detected intent: ${intent}`,
    `User question: ${message}`,
  ].join('\n');
}

/** Parse JSON report for Dynamic Inventory Shortage (same Claude+MCP path as /api/frepple/query). */
function parseInventoryShortageJson(raw) {
  const text = stripMarkdownFences(String(raw || ''));
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start >= 0 && end > start) {
      parsed = JSON.parse(text.slice(start, end + 1));
    } else {
      throw new Error('Could not parse inventory shortage JSON from Claude output');
    }
  }
  const required = ['snapshot', 'delayed_pos', 'demand_at_risk', 'root_causes', 'actions'];
  for (const key of required) {
    if (!parsed[key]) throw new Error(`Missing field: ${key}`);
  }
  return parsed;
}

function parseStructuredResponse(raw, fallbackIntent) {
  const text = stripMarkdownFences(raw);
  try {
    const parsed = JSON.parse(text);
    return {
      intent: parsed.intent || fallbackIntent,
      summary: parsed.summary || 'Response received.',
      kpis: parsed.kpis && typeof parsed.kpis === 'object' ? parsed.kpis : {},
      rows: Array.isArray(parsed.rows) ? parsed.rows : [],
      narrative: extractNarrative(parsed),
      recommendations: normalizeRecommendations(parsed),
      raw: String(raw || '').trim(),
    };
  } catch {
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start >= 0 && end > start) {
      try {
        const parsed = JSON.parse(text.slice(start, end + 1));
        return {
          intent: parsed.intent || fallbackIntent,
          summary: parsed.summary || 'Response received.',
          kpis: parsed.kpis && typeof parsed.kpis === 'object' ? parsed.kpis : {},
          rows: Array.isArray(parsed.rows) ? parsed.rows : [],
          narrative: extractNarrative(parsed),
          recommendations: normalizeRecommendations(parsed),
          raw: String(raw || '').trim(),
        };
      } catch {
        // fall through
      }
    }
  }
  return {
    intent: fallbackIntent,
    summary: text || 'No response generated.',
    kpis: {},
    rows: [],
    narrative: '',
    recommendations: [],
    raw: text,
  };
}

const tallyPath = path.join(MCP_ROOT, 'dist', 'tally.mjs');
let handlePull;
async function getHandlePull() {
  if (!handlePull) {
    const mod = await import(pathToFileURL(tallyPath).href);
    handlePull = mod.handlePull;
  }
  return handlePull;
}

const app = express();
app.use(cors({ origin: true }));
app.use(express.json({ limit: '4mb' }));

/** Dynamic Inventory Shortage — shared by POST /api/frepple/query?mode=inventory_shortage and POST /api/frepple/inventory-shortage */
async function handleInventoryShortage(_req, res) {
  try {
    const claudeBin = resolveClaudeExecutable();
    const { code, stdout, stderr } = await runClaudePrintMode(
      claudeBin,
      ['--dangerously-skip-permissions', '-p', FREPPLE_INVENTORY_SHORTAGE_PROMPT.trim()],
      CLAUDE_WORKDIR,
      120000
    );
    if (!stdout.trim()) {
      const msg =
        stderr.trim() ||
        (code !== 0 ? `Claude exited with code ${code}` : 'Empty response from Claude');
      return res.status(500).json({ error: msg });
    }
    const data = parseInventoryShortageJson(stdout);
    const benignStderr =
      /no stdin data received/i.test(stderr) || /proceeding without it/i.test(stderr);
    const warning = stderr.trim() && !benignStderr ? stderr.trim() : undefined;
    res.json({ data, ...(warning ? { warning } : {}) });
  } catch (e) {
    res.status(500).json({ error: e?.message || 'Inventory shortage analysis failed' });
  }
}

/** Anthropic Messages API proxy — key from ANTHROPIC_API_KEY (see .env / Vercel secrets). */
app.post('/api/anthropic-messages', async (req, res) => {
  try {
    const body = req.body;
    if (!body || typeof body !== 'object') {
      return res.status(400).json({ error: 'JSON body required' });
    }
    const { status, text } = await proxyAnthropicMessages(body);
    res.status(status).type('application/json').send(text);
  } catch (e) {
    const code = e.statusCode || 500;
    res.status(code).json({ error: e.message || 'Anthropic proxy error' });
  }
});

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, tallyMcpRoot: MCP_ROOT });
});

/** Company names from Tally (list-master → Company collection). */
app.get('/api/companies', async (_req, res) => {
  try {
    const params = new Map([['collection', 'company']]);
    const pull = await getHandlePull();
    const resp = await pull('list-master', params);
    if (resp.error) {
      return res.status(400).json({ error: resp.error });
    }
    const rows = resp.data ?? [];
    const names = rows
      .map((r) => (typeof r.name === 'string' ? r.name.trim() : ''))
      .filter(Boolean);
    names.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
    res.json({ companies: names });
  } catch (e) {
    res.status(500).json({ error: e?.message || 'Server error' });
  }
});

app.get('/api/chart-of-accounts', async (req, res) => {
  try {
    const params = new Map();
    const company = req.query.company;
    if (company && String(company).trim()) {
      params.set('targetCompany', String(company).trim());
    }
    const pull = await getHandlePull();
    const resp = await pull('chart-of-accounts', params);
    if (resp.error) {
      return res.status(400).json({ error: resp.error });
    }
    res.json({ rows: resp.data ?? [] });
  } catch (e) {
    res.status(500).json({ error: e?.message || 'Server error' });
  }
});

app.get('/api/trial-balance', async (req, res) => {
  try {
    const from = req.query.from;
    const to = req.query.to;
    if (!from || !to) {
      return res.status(400).json({ error: 'Query params "from" and "to" are required (YYYY-MM-DD).' });
    }
    const params = new Map([
      ['fromDate', String(from)],
      ['toDate', String(to)],
    ]);
    const company = req.query.company;
    if (company && String(company).trim()) {
      params.set('targetCompany', String(company).trim());
    }
    const pull = await getHandlePull();
    const resp = await pull('trial-balance', params);
    if (resp.error) {
      return res.status(400).json({ error: resp.error });
    }
    res.json({ rows: resp.data ?? [] });
  } catch (e) {
    res.status(500).json({ error: e?.message || 'Server error' });
  }
});

app.post('/api/frepple/chat', async (req, res) => {
  try {
    const message = String(req.body?.message || '').trim();
    if (!message) {
      return res.status(400).json({ error: 'message is required' });
    }
    const prompt = [
      'You are a Y3 Planning Assistant.',
      'Use only Y3 MCP tools to answer.',
      'For list requests, cap response to 20 rows.',
      'Prefer paths such as input/demand/, input/item/, input/customer/, input/location/, input/deliveryorder/.',
      'When returning tabular data, format as compact markdown table.',
      `User question: ${message}`,
    ].join('\n');
    const claudeBin = resolveClaudeExecutable();
    const { code, stdout, stderr } = await runClaudePrintMode(
      claudeBin,
      ['--dangerously-skip-permissions', '-p', prompt],
      CLAUDE_WORKDIR,
      120000
    );
    if (!stdout.trim()) {
      const msg =
        stderr.trim() ||
        (code !== 0 ? `Claude exited with code ${code}` : 'Empty response from Claude');
      return res.status(500).json({ error: msg });
    }
    const benignStderr =
      /no stdin data received/i.test(stderr) || /proceeding without it/i.test(stderr);
    const warn = stderr.trim() && !benignStderr ? stderr.trim() : undefined;
    res.json({ answer: stdout.trim(), ...(warn ? { warning: warn } : {}) });
  } catch (e) {
    res.status(500).json({ error: e?.message || 'Y3 chat failed' });
  }
});

app.post('/api/frepple/query', async (req, res) => {
  try {
    const mode = String(req.body?.mode || '').trim();
    if (mode === 'inventory_shortage') {
      return await handleInventoryShortage(req, res);
    }
    const message = String(req.body?.message || '').trim();
    if (!message) {
      return res.status(400).json({ error: 'message is required' });
    }
    const intent = detectIntent(message);
    const prompt = buildFreppleStructuredPrompt({ message, intent });
    const claudeBin = resolveClaudeExecutable();
    const { code, stdout, stderr } = await runClaudePrintMode(
      claudeBin,
      ['--dangerously-skip-permissions', '-p', prompt],
      CLAUDE_WORKDIR,
      120000
    );
    if (!stdout.trim()) {
      const msg =
        stderr.trim() ||
        (code !== 0 ? `Claude exited with code ${code}` : 'Empty response from Claude');
      return res.status(500).json({ error: msg });
    }
    const result = parseStructuredResponse(stdout, intent);
    const benignStderr =
      /no stdin data received/i.test(stderr) || /proceeding without it/i.test(stderr);
    const warning = stderr.trim() && !benignStderr ? stderr.trim() : undefined;
    res.json({
      ...result,
      ...(warning ? { warning } : {}),
    });
  } catch (e) {
    res.status(500).json({ error: e?.message || 'Y3 query failed' });
  }
});

/** Optional alias — prefer POST /api/frepple/query with body: { mode: "inventory_shortage", message: "…" } */
app.post('/api/frepple/inventory-shortage', handleInventoryShortage);

const server = app.listen(PORT, () => {
  console.log(`Tally API http://127.0.0.1:${PORT} (TALLY_MCP_ROOT=${MCP_ROOT})`);
});

server.on('error', (err) => {
  console.error('API listen error:', err.message);
  process.exit(1);
});

// Keep process alive when stdin is a closed pipe (Windows + some task runners)
if (process.stdin.isTTY !== true) {
  try {
    process.stdin.resume();
  } catch {
    /* ignore */
  }
}
