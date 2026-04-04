import { AsyncLocalStorage } from 'node:async_hooks';

const tallyAsyncLocal = new AsyncLocalStorage();

/**
 * Effective Tally XML/HTTP target for this request (set by middleware from query or env).
 */
export function getTallyConnection() {
  const stored = tallyAsyncLocal.getStore();
  if (stored) return stored;
  return {
    host: process.env.TALLY_HOST || '127.0.0.1',
    port: Number(process.env.TALLY_PORT || 9000),
  };
}

export function runWithTallyConnection(conn, fn) {
  return tallyAsyncLocal.run(conn, fn);
}

function clientOverrideAllowed() {
  const v = process.env.TALLY_ALLOW_CLIENT_OVERRIDE;
  if (v === undefined || v === '') return true;
  return v !== 'false' && v !== '0';
}

/** Strip protocol/path; optional host:port in host field returns hostname only. */
export function sanitizeTallyHost(raw) {
  let s = String(raw || '').trim();
  if (!s) return '';
  if (/^https?:\/\//i.test(s)) {
    try {
      return new URL(s).hostname || '';
    } catch {
      return '';
    }
  }
  const noPath = s.split('/')[0];
  if (noPath.includes(':') && !noPath.startsWith('[')) {
    const parts = noPath.split(':');
    if (parts.length === 2 && /^\d+$/.test(parts[1])) return parts[0];
  }
  return noPath;
}

function hostAllowed(host) {
  if (!host || host.length > 253) return false;
  const lower = host.toLowerCase();
  if (lower === 'localhost' || lower === '127.0.0.1' || lower === '::1') return true;
  const extra = process.env.TALLY_ALLOWED_HOSTS;
  if (extra?.trim()) {
    const set = extra
      .split(',')
      .map((x) => x.trim().toLowerCase())
      .filter(Boolean);
    if (set.includes(lower)) return true;
  }
  if (/^\[[0-9a-f:]+\]$/i.test(host)) return true;
  if (/^(\d{1,3}\.){3}\d{1,3}$/.test(host)) return true;
  if (/^[a-zA-Z0-9][a-zA-Z0-9.-]*[a-zA-Z0-9]$/.test(host) || /^[a-zA-Z0-9]+$/.test(host)) {
    return true;
  }
  return false;
}

function resolveFromRequest(req) {
  const envHost = process.env.TALLY_HOST || '127.0.0.1';
  const envPort = Number(process.env.TALLY_PORT || 9000);
  if (!clientOverrideAllowed()) {
    return { host: envHost, port: envPort };
  }
  const qh = req.query?.tallyHost;
  const qp = req.query?.tallyPort;
  let host = envHost;
  let port = envPort;
  if (qh != null && String(qh).trim()) {
    const parsed = sanitizeTallyHost(String(qh));
    if (!parsed || !hostAllowed(parsed)) {
      return { error: 'Invalid or disallowed Tally host (check TALLY_ALLOWED_HOSTS).' };
    }
    host = parsed;
  }
  if (qp != null && String(qp).trim() !== '') {
    const n = Number(qp);
    if (!Number.isFinite(n) || n < 1 || n > 65535) {
      return { error: 'Invalid Tally port' };
    }
    port = Math.trunc(n);
  }
  return { host, port };
}

/**
 * Express middleware: bind AsyncLocalStorage so tally.mjs and tally-xml-post see the same host/port.
 */
export function tallyConnectionMiddleware(req, res, next) {
  const resolved = resolveFromRequest(req);
  if (resolved.error) {
    res.status(400).json({ error: resolved.error });
    return;
  }
  runWithTallyConnection({ host: resolved.host, port: resolved.port }, () => next());
}
