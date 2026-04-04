/**
 * Shared proxy to TALLY_BACKEND_URL.
 * @param {import('http').IncomingMessage} req
 * @param {import('http').ServerResponse} res
 * @param {string} [pathOverride] - e.g. '/api/companies' when Vercel gives req.url as '/' or incomplete
 */
export default async function forwardTallyBackend(req, res, pathOverride) {
  const base = String(process.env.TALLY_BACKEND_URL || '').trim().replace(/\/+$/, '');
  if (!base) {
    return res.status(500).json({
      error:
        'TALLY_BACKEND_URL is not set on Vercel. Project → Settings → Environment Variables (e.g. https://tally-mcp-api.onrender.com).',
    });
  }

  const raw = String(req.url || '/');
  const qs = raw.includes('?') ? raw.slice(raw.indexOf('?')) : '';
  const pathAndQuery = pathOverride ? pathOverride + qs : raw;

  const targetUrl = `${base}${pathAndQuery.startsWith('/') ? pathAndQuery : `/${pathAndQuery}`}`;

  const headers = new Headers();
  const ctIn = req.headers['content-type'];
  if (ctIn) headers.set('content-type', ctIn);
  const auth = req.headers.authorization;
  if (auth) headers.set('authorization', auth);

  const init = {
    method: req.method,
    headers,
    redirect: 'manual',
  };

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    if (typeof req.body === 'string') {
      init.body = req.body;
    } else if (Buffer.isBuffer(req.body)) {
      init.body = req.body;
    } else if (req.body != null && typeof req.body === 'object') {
      init.body = JSON.stringify(req.body);
      if (!ctIn) headers.set('content-type', 'application/json');
    }
  }

  try {
    const upstream = await fetch(targetUrl, init);
    const text = await upstream.text();
    const ctOut = upstream.headers.get('content-type');
    if (ctOut) res.setHeader('content-type', ctOut);
    return res.status(upstream.status).send(text);
  } catch (e) {
    return res.status(502).json({
      error: e?.message || 'Unable to reach TALLY_BACKEND_URL',
    });
  }
}
