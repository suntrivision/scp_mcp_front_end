# Deploy SC Trivision Assistant on Vercel

Vercel hosts the **Vite** frontend and **serverless** `/api/*` routes. Heavy logic (Claude, Tally MCP, frePPLe) still runs on a **Node backend** you deploy elsewhere (e.g. Render).

## Architecture in production

- **Static UI** — `npm run build` output (`dist/`).
- **frePPLe** — `api/frepple/*.mjs` proxies to `FREPPLE_BACKEND_URL` (unchanged).
- **Tally + rest of Node API** — explicit serverless files (`api/companies.mjs`, `api/chart-of-accounts.mjs`, `api/trial-balance.mjs`, `api/health.mjs`, `api/tally/*.mjs`) share `api/lib/forwardTallyBackend.mjs` and forward to **`TALLY_BACKEND_URL`**. Functions under `api/frepple/*` and `api/anthropic-messages.js` stay separate.
- Set **`TALLY_BACKEND_URL`** in the Vercel project to that Node base URL (no trailing slash). The browser can keep **`VITE_API_BASE_URL` unset** so requests stay same-origin (`/api/...` → Vercel → upstream).

Your backend (`server/index.mjs`) runs on the host you set in `TALLY_BACKEND_URL` / `FREPPLE_BACKEND_URL`.

## 1) Make your backend publicly reachable

Your backend must expose (same Claude + Y3 MCP stack as local `server/index.mjs`):

- `POST /api/frepple/query` — must handle `{"mode":"inventory_shortage","message":"…"}` for Dynamic Inventory (this repo’s `server/index.mjs` does this)

If the backend is a **separate repo** (e.g. MCPSCP on Render), implement that branch using **`server/BACKEND_INVENTORY_SHORTAGE.md`** (contract + copy-paste notes).

Examples:

- Deploy backend to a VM/container.
- Or use a tunnel (Cloudflare Tunnel / ngrok) for testing.

## 2) Deploy frontend to Vercel

From project root:

```bash
vercel
```

Then set these in the Vercel project **Settings → Environment Variables**:

- `TALLY_BACKEND_URL=https://your-node-api.example.com` — base URL for the catch-all proxy (e.g. Render `tally-mcp-api`).
- `FREPPLE_BACKEND_URL=https://your-public-backend.example.com` — used by `api/frepple/*` proxies.

If you prefer the browser to call the Node API **directly** (no Vercel proxy for Tally), omit `TALLY_BACKEND_URL` and build with `VITE_API_BASE_URL=https://your-node-api.example.com` instead (CORS must allow your Vercel origin on the Node server).

Redeploy after setting env vars:

```bash
vercel --prod
```

## 3) Verify

- Open your Vercel URL.
- Go to **SC Trivision Assistant**.
- Ask a question like: `Show late orders this week`.

If you get an error:

- Check Vercel function logs for `/api/frepple/query`.
- Confirm backend URL is reachable from internet.
- Confirm backend CORS/firewall allows Vercel requests.
