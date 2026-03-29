/**
 * Default exception report instructions for `/api/frepple/query`.
 * Server may wrap this; keep JSON schema instructions intact.
 */
export const EXCEPTION_DASHBOARD_PROMPT = `Build an exception dashboard dataset for demand planners using live data from Y3 MCP tools where available.

**Data sources to query:**
- Sales orders / demands: input/demand/
- Forecast plan: forecast/forecastplan/
- Inventory buffers: input/buffer/
- Purchase / supply: as exposed by MCP (e.g. purchase orders, suppliers)
- Delivery orders: input/deliveryorder/
- Distribution orders: input/distributionorder/

**Root cause categories to detect and explain (map each row to one primary category):**
- Supplier delay — PO exists but delivery is late or pushed out
- Forecast miss — actual demand significantly exceeded forecast
- No reorder triggered — item fell below ROP with no PO raised
- Lead time error — lead time in system shorter than actual supplier lead time
- Distribution gap — stock exists at another location but no transfer was planned

Also retain classic planning exceptions where visible: late/unplanned demand, forecast deviation vs buffer rules, delivery shortfalls, distribution imbalance.

**JSON response (no markdown, no prose outside JSON):**
{
  "intent": "exception_dashboard",
  "summary": "One short professional paragraph summarizing overall exception posture.",
  "kpis": {
    "Supplier delay": <integer>,
    "Forecast miss": <integer>,
    "No reorder triggered": <integer>,
    "Lead time error": <integer>,
    "Distribution gap": <integer>
  },
  "narrative": "Main explanatory paragraph for planners: what the exception picture means and where to focus first.",
  "recommendations": [
    "Prioritized action 1",
    "Prioritized action 2"
  ],
  "rows": [
    {
      "item": "id or name",
      "location": "id or name",
      "root_cause_category": "must match one of the five KPI labels above when applicable",
      "exception_type": "same as root_cause_category or more specific sub-label",
      "severity": "High" | "Medium" | "Low",
      "recommended_action": "concise planner action",
      "detail": "short explanation of why this exception was flagged"
    }
  ]
}

Use severity: High = revenue or service risk; Medium = planning risk; Low = watchlist.
Order rows by severity (High first), then root_cause_category. Include at most 80 rows. Use 0 for KPIs with no matches.`;
