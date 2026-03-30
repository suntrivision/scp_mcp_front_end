# Deploy SC Trivision Assistant on Vercel

This project can be deployed to Vercel for web access, but the frePPLe MCP logic still runs in your backend environment.

## Architecture in production

- Vercel hosts the React app and `/api/frepple/*` serverless endpoints (`query`, `inventory-shortage`, …).
- Vercel endpoint proxies requests to your backend URL via `FREPPLE_BACKEND_URL`.
- Your backend (current `server/index.mjs`) remains where Claude + MCP + frePPLe are installed.

## 1) Make your backend publicly reachable

Your backend must expose (same Claude + Y3 MCP stack as local `server/index.mjs`):

- `POST /api/frepple/query`
- `POST /api/frepple/inventory-shortage` (Dynamic Inventory Shortage Agent)

Examples:

- Deploy backend to a VM/container.
- Or use a tunnel (Cloudflare Tunnel / ngrok) for testing.

## 2) Deploy frontend to Vercel

From project root:

```bash
vercel
```

Then set this environment variable in the Vercel project:

- `FREPPLE_BACKEND_URL=https://your-public-backend.example.com`

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
