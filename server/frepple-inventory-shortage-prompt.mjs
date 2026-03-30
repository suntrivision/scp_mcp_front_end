/**
 * Same task description as the former Anthropic+MCP path: Claude Code uses local Y3 MCP tools.
 */
export const FREPPLE_INVENTORY_SHORTAGE_PROMPT = `
You are a supply chain analyst. Using the frePPLe MCP tools, fetch and analyse
inventory shortage data. Run these three tool calls:

1. frepple_get_named: endpoint="purchase_orders", format="json", limit=100
2. frepple_get_named: endpoint="sales_orders", format="json", limit=100
3. frepple_get_named: endpoint="manufacturing_production_orders", format="json", limit=50

Then analyse the results and return ONLY a valid JSON object — no markdown, no
explanation, no code fences — in exactly this shape:

{
  "snapshot": {
    "overdue_pos": <integer — count of POs where delay is not null/zero>,
    "items_at_risk": <integer — distinct item names in delayed POs>,
    "unplanned_orders": <integer — sales orders where plannedquantity is null>,
    "max_delay_days": <number — highest delay converted to days, 1 decimal>
  },
  "delayed_pos": [
    {
      "ref": "string",
      "item": "string",
      "supplier": "string",
      "qty": <number>,
      "arrival": "DD MMM YYYY",
      "delay_days": <number, 1 decimal>,
      "severity": "Critical|High|Late",
      "pegged_demands": ["string"]
    }
  ],
  "demand_at_risk": [
    {
      "order": "string",
      "item": "string",
      "customer": "string",
      "due": "string",
      "qty": <number or "Multiple">,
      "issue": "string"
    }
  ],
  "root_causes": [
    {
      "title": "string",
      "description": "string",
      "affected_items": ["string"],
      "severity_pct": <0-100>,
      "type": "supplier_late|planning_gap|component_shortage|systemic_supplier"
    }
  ],
  "actions": [
    {
      "rank": <integer>,
      "action": "string",
      "priority": "Urgent|High|Medium"
    }
  ]
}

Rules for parsing the frePPLe delay field (it comes as a duration string):
- "37 08:00:00"  → 37.3 days   (positive = delayed, INCLUDE)
- "-18 22:00:00" → negative    (early, EXCLUDE from delayed list)
- "00:00:00"     → 0           (on time, EXCLUDE)
- "3 16:00:00"   → 3.7 days

Severity rules:
- delay_days > 30  → "Critical"
- delay_days 10-30 → "High"
- delay_days > 0   → "Late"

Root cause derivation:
- confirmed PO (status="confirmed") with delay > 0             → type: "supplier_late"
- sales order with null plannedquantity or null deliverydate   → type: "planning_gap"
- same supplier on 3+ delayed POs                              → type: "systemic_supplier"
- same item in pegging of 3+ delayed POs                      → type: "component_shortage"

severity_pct should reflect relative impact (100 = worst issue found).
Sort delayed_pos by delay_days descending.
Sort actions by priority (Urgent first).
Return ONLY the raw JSON object. Nothing else.
`;
