import { AsyncLocalStorage } from 'node:async_hooks';

const tallyAsyncLocal = new AsyncLocalStorage();
const DEFAULT_TALLY_PORT = 9000;

/** Node may emit AggregateError when TCP fails (e.g. IPv4 + IPv6); surface nested causes. */
export function formatNodeError(err) {
  if (err == null) return 'Unknown error';
  if (typeof err === 'string') return err;
  if (err.name === 'AggregateError' && Array.isArray(err.errors) && err.errors.length) {
    const parts = err.errors.map((e) => {
      const code = e && e.code ? `${e.code} ` : '';
      const msg = e && e.message ? e.message : String(e);
      return `${code}${msg}`.trim();
    });
    return parts.filter(Boolean).join('; ') || err.message || 'Multiple connection failures';
  }
  return err.message || String(err);
}

/**
 * Parse TALLY_HOST (may be `http://ip`, `http://ip:9000`, or bare `ip`) and TALLY_PORT.
 * URLs without an explicit port use TALLY_PORT / default 9000 — never HTTP's implicit 80.
 */
export function parseTallyHostPort(rawHost, rawPort) {
  const portFromEnv = (() => {
    const n = Number(rawPort);
    if (Number.isFinite(n) && n >= 1 && n <= 65535) return Math.trunc(n);
    return DEFAULT_TALLY_PORT;
  })();

  const h = String(rawHost || '').trim();
  if (!h) return { host: '127.0.0.1', port: portFromEnv };

  if (/^https?:\/\//i.test(h)) {
    try {
      const u = new URL(h);
      const host = u.hostname || '';
      const explicit = u.port;
      const port = explicit ? Number(explicit) : portFromEnv;
      return {
        host,
        port: Number.isFinite(port) && port >= 1 && port <= 65535 ? port : portFromEnv,
      };
    } catch {
      return { host: sanitizeTallyHost(h) || '127.0.0.1', port: portFromEnv };
    }
  }

  const noPath = h.split('/')[0];
  if (noPath.includes(':') && !noPath.startsWith('[')) {
    const parts = noPath.split(':');
    const last = parts[parts.length - 1];
    if (/^\d+$/.test(last)) {
      const portNum = Number(last);
      const hostOnly = parts.slice(0, -1).join(':');
      if (hostOnly && portNum >= 1 && portNum <= 65535) {
        return { host: hostOnly, port: portNum };
      }
    }
  }
  return { host: noPath, port: portFromEnv };
}

/**
 * Effective Tally XML/HTTP target for this request (set by middleware from query or env).
 */
export function getTallyConnection() {
  const stored = tallyAsyncLocal.getStore();
  if (stored) return stored;
  return parseTallyHostPort(process.env.TALLY_HOST, process.env.TALLY_PORT);
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
  if (!clientOverrideAllowed()) {
    return parseTallyHostPort(process.env.TALLY_HOST, process.env.TALLY_PORT);
  }
  const qh = req.query?.tallyHost;
  const qp = req.query?.tallyPort;
  if (qh != null && String(qh).trim()) {
    const { host, port } = parseTallyHostPort(String(qh), qp != null && String(qp).trim() !== '' ? qp : process.env.TALLY_PORT);
    if (!host || !hostAllowed(host)) {
      return { error: 'Invalid or disallowed Tally host (check TALLY_ALLOWED_HOSTS).' };
    }
    return { host, port };
  }
  return parseTallyHostPort(process.env.TALLY_HOST, process.env.TALLY_PORT);
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
