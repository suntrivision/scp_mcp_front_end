# Backend: Dynamic Inventory Shortage (`mode: inventory_shortage`)

The Vercel app calls **`FREPPLE_BACKEND_URL`** with **`POST /api/frepple/query`**.  
AI Reporting Agent uses the same route **without** `mode`.  
**Dynamic Inventory Shortage** sends **`mode: "inventory_shortage"`** and expects a different JSON shape.

If your backend (e.g. **Render / MCPSCP**) only implements the reporting query, the UI will show an error until you add the branch below.

## Request contract

```http
POST /api/frepple/query
Content-Type: application/json; charset=utf-8

{
  "mode": "inventory_shortage",
  "message": "inventory_shortage"
}
```

(The `message` value is a placeholder; the real work is driven by `mode`.)

## Success response shape

HTTP **200** and JSON body:

```json
{
  "data": {
    "snapshot": { "overdue_pos": 0, "items_at_risk": 0, "unplanned_orders": 0, "max_delay_days": 0 },
    "delayed_pos": [],
    "demand_at_risk": [],
    "root_causes": [],
    "actions": []
  }
}
```

Optional: `"warning": "…"` if you surface stderr from Claude.

## Implementation (copy into your Express route)

1. **Branch first** on `POST /api/frepple/query` before your normal NL reporting logic:

```js
const mode = String(req.body?.mode || '').trim();
if (mode === 'inventory_shortage') {
  return handleInventoryShortage(req, res);
}
// … existing reporting query …
```

2. **`handleInventoryShortage`** should:

- Run **Claude** (same way as your existing `/api/frepple/query` — e.g. `claude -p` / Claude Code with Y3 MCP).
- Pass the **prompt** that asks for the shortage JSON only. In this repo copy **`server/frepple-inventory-shortage-prompt.mjs`** (`FREPPLE_INVENTORY_SHORTAGE_PROMPT`) verbatim or adapt tool names to match your MCP.
- Parse stdout into JSON with **`snapshot`** / **`delayed_pos`** / **`demand_at_risk`** / **`root_causes`** / **`actions`** (strip ` ```json ` fences if present).
- Respond with **`res.json({ data: parsed })`**.

Reference implementation in **this** repo:

| Piece | File |
|--------|------|
| Handler | `server/index.mjs` — `handleInventoryShortage` |
| Prompt | `server/frepple-inventory-shortage-prompt.mjs` |
| JSON parse + validation | `server/index.mjs` — `parseInventoryShortageJson` (same file, above `parseStructuredResponse`) |

Optional alias route (not required for the Vercel proxy): **`POST /api/frepple/inventory-shortage`** can call the same handler.

## Verify

```bash
curl -s -X POST "$BACKEND/api/frepple/query" \
  -H "Content-Type: application/json" \
  -d '{"mode":"inventory_shortage","message":"inventory_shortage"}' | head -c 400
```

You should see `"data":{` and the five top-level keys inside `data`.
