import { useState, useCallback, useEffect } from "react";

// ── Anthropic: calls go through /api/anthropic-messages (local Express or Vercel) ─
// so the API key stays server-side — set ANTHROPIC_API_KEY in Vercel or .env (see .env.example).

// ── frePPLe MCP server (Anthropic Messages API `mcp_servers[].url`) ───────────
// Default: Render deployment. Override with VITE_FREPPLE_MCP_URL if your MCP path differs (e.g. …/mcp or …/sse).
const FREPPLE_MCP_URL_RAW =
  typeof import.meta !== "undefined" && import.meta.env.VITE_FREPPLE_MCP_URL
    ? String(import.meta.env.VITE_FREPPLE_MCP_URL).trim()
    : "https://agenticshop-frepple-numm.onrender.com";

const FREPPLE_MCP_SERVER = {
  type: "url",
  url: FREPPLE_MCP_URL_RAW.replace(/\/+$/, ""),
  name: "frepple",
};

// ── The analysis prompt ───────────────────────────────────────────────────────
// Claude fetches from frePPLe via MCP, parses the raw data,
// and returns a clean JSON object matching the shape the report expects.
const ANALYSIS_PROMPT = `
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

// ── Helper: parse frePPLe delay string → decimal days ────────────────────────
// (Used as a fallback if Claude's output needs validation)
export function parseDelayDays(delayStr) {
  if (!delayStr || delayStr === "00:00:00") return 0;
  const isNeg = delayStr.startsWith("-");
  const clean = delayStr.replace(/^-/, "");
  const parts = clean.split(" ");
  let days = 0;
  if (parts.length === 2) {
    days = parseInt(parts[0], 10);
    const [h] = parts[1].split(":").map(Number);
    days += h / 24;
  } else {
    const [h] = parts[0].split(":").map(Number);
    days = h / 24;
  }
  return isNeg ? -days : Math.round(days * 10) / 10;
}

// ── Main hook ─────────────────────────────────────────────────────────────────
export function useFreppleShortageData() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [statusMsg, setStatusMsg] = useState("");

  const fetchReport = useCallback(async () => {
    setLoading(true);
    setError(null);
    setData(null);

    try {
      // ── Step 1: Ask Claude to fetch + analyse frePPLe data via MCP (key on server) ─
      setStatusMsg(`Connecting to MCP at ${FREPPLE_MCP_SERVER.url}…`);

      const response = await fetch("/api/anthropic-messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-6",
          max_tokens: 8192,
          mcp_servers: [FREPPLE_MCP_SERVER],
          messages: [{ role: "user", content: ANALYSIS_PROMPT }],
        }),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        const msg =
          (typeof err.error === "string" && err.error) ||
          err.error?.message ||
          `API error ${response.status}`;
        throw new Error(msg);
      }

      const result = await response.json();

      // ── Step 2: Extract the JSON text from Claude's response ─────────────────
      setStatusMsg("Parsing results...");

      // Claude may return multiple content blocks (tool_use, tool_result, text).
      // We want the final text block which contains the JSON.
      const textBlock = result.content
        .filter((b) => b.type === "text")
        .pop();

      if (!textBlock) {
        throw new Error("Claude returned no text. Check your MCP server URL and API key.");
      }

      // Strip any accidental markdown fences Claude may have added
      const rawJson = textBlock.text
        .replace(/^```(?:json)?\n?/m, "")
        .replace(/\n?```$/m, "")
        .trim();

      const parsed = JSON.parse(rawJson);

      // ── Step 3: Basic validation ──────────────────────────────────────────────
      const required = ["snapshot", "delayed_pos", "demand_at_risk", "root_causes", "actions"];
      for (const key of required) {
        if (!parsed[key]) throw new Error(`Missing field: ${key}`);
      }

      setData(parsed);
      setStatusMsg("");
    } catch (e) {
      setError(e.message || "Unknown error");
      setStatusMsg("");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchReport();
  }, [fetchReport]);

  return { data, loading, error, statusMsg, fetchReport };
}