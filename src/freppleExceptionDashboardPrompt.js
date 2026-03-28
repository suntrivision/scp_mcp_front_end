/**
 * Instructions sent to the frePPLe MCP-backed `/api/frepple/query` endpoint.
 * The server wraps this in its structured-JSON system prompt; keep output valid JSON only.
 */
export const EXCEPTION_DASHBOARD_PROMPT = `Build an exception dashboard dataset for demand planners using ONLY frePPLe MCP tools (live data).

**Data sources to query:**
- Sales orders / demands: input/demand/ — late, unplanned, or overdue
- Forecast plan: forecast/forecastplan/ — large forecast vs actual deviations
- Inventory buffers: input/buffer/ — stockouts and excess inventory
- Delivery orders: input/deliveryorder/ — short shipments or unconfirmed supply
- Distribution orders: input/distributionorder/ — infeasible or imbalanced transfers

**Exception rules (use the current calendar date as "today"):**
- Late demand: requested/due date is before today and the demand is still open or not fully delivered
- Unplanned demand: demand appears open without an associated or pegged delivery order (use MCP fields; if pegging unavailable, infer cautiously from status)
- Excess inventory: on hand greater than 2× the maximum inventory policy / max level on the buffer
- Stockout risk: on hand below safety stock (or below minimum if safety stock missing)
- Forecast deviation: where forecast and actual (or realized) figures exist, flag when |forecast − actual| / max(|forecast|, 1e-6) > 30%
- Delivery order issues: delivered quantity below planned, or supply unconfirmed / critically late
- Distribution order issues: infeasible, delayed, or clearly imbalanced transfer quantities between source and destination

**JSON response (no markdown, no prose outside JSON):**
{
  "intent": "exception_dashboard",
  "summary": "One short professional paragraph summarizing overall exception posture for planners.",
  "kpis": {
    "Late demand": <integer count>,
    "Unplanned demand": <integer>,
    "Forecast deviation": <integer>,
    "Excess inventory": <integer>,
    "Stockout risk": <integer>,
    "Delivery order issue": <integer>,
    "Distribution order issue": <integer>
  },
  "rows": [
    {
      "item": "item id or name or —",
      "location": "location id or name or —",
      "exception_type": "must match one of the seven KPI labels above",
      "severity": "High" | "Medium" | "Low",
      "recommended_action": "concise action for a demand planner"
    }
  ]
}

Severity guidance: High = revenue or service risk (late line, stockout, major short ship); Medium = planning/flexibility risk; Low = monitor or minor deviation.
Order rows by severity (High first), then by exception_type. Include at most 80 rows. Use 0 for any KPI with no matching exceptions.`;
