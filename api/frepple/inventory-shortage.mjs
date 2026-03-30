export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const backendBase = process.env.FREPPLE_BACKEND_URL;
  if (!backendBase) {
    return res.status(500).json({
      error:
        'FREPPLE_BACKEND_URL is not configured on Vercel. Set it to your public backend base URL.',
    });
  }

  const target = `${backendBase.replace(/\/+$/, '')}/api/frepple/inventory-shortage`;

  try {
    const upstream = await fetch(target, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    const data = await upstream.json().catch(() => ({}));
    return res.status(upstream.status).json(data);
  } catch (error) {
    return res.status(502).json({
      error: error?.message || 'Unable to reach Y3 backend',
    });
  }
}
