/**
 * InventoryStrategist.jsx
 * Stockout Risk Agent — drop this file into your React app and import it.
 *
 * Usage:
 *   import InventoryStrategist from './InventoryStrategist';
 *   <InventoryStrategist />
 *
 * The component calls the Anthropic API directly (claude-sonnet-4-20250514)
 * using the frePPLe MCP server to pull live buffer + purchase-order data,
 * identify stockout risks, cross-check neighboring locations for excess stock,
 * and present actionable transfer suggestions in a rich UI.
 */

import { useState, useEffect, useRef } from "react";

// ─── palette & tokens ────────────────────────────────────────────────────────
const T = {
  bg: "var(--bg)",
  panel: "var(--surface)",
  panelBorder: "var(--border)",
  accent: "var(--brand-bright)", // Y3 violet accent
  accentLow: "#22c55e",    // green — healthy
  accentWarn: "#eab308",   // amber — warning
  accentDanger: "#ef4444", // red — critical
  text: "var(--text)",
  textMuted: "var(--muted)",
  textDim: "#d9c9e6",
  mono: "'JetBrains Mono', 'Fira Mono', monospace",
  sans: "'DM Sans', 'Segoe UI', sans-serif",
};

// ─── inline styles ────────────────────────────────────────────────────────────
const S = {
  root: {
    background: T.bg,
    minHeight: "100vh",
    color: T.text,
    fontFamily: T.sans,
    padding: "0",
  },
  header: {
    borderBottom: `1px solid ${T.panelBorder}`,
    padding: "20px 28px",
    display: "flex",
    alignItems: "center",
    gap: 14,
    background: "linear-gradient(90deg, rgba(74, 31, 104, 0.95) 0%, rgba(28, 16, 40, 0.95) 55%, rgba(107, 45, 145, 0.35) 100%)",
    backdropFilter: "blur(8px)",
    position: "sticky",
    top: 0,
    zIndex: 10,
  },
  headerIcon: {
    width: 38,
    height: 38,
    borderRadius: 8,
    background: `linear-gradient(135deg, var(--brand-bright), var(--brand))`,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 18,
    flexShrink: 0,
    boxShadow: "0 0 16px rgba(142, 77, 196, 0.45)",
  },
  headerText: { flex: 1 },
  headerTitle: { fontSize: 16, fontWeight: 700, letterSpacing: "0.02em" },
  headerSub: { fontSize: 12, color: T.textMuted, marginTop: 2 },
  runBtn: {
    background: `linear-gradient(135deg, var(--brand-bright), var(--brand))`,
    border: "none",
    borderRadius: 8,
    color: "#fff",
    fontFamily: T.sans,
    fontWeight: 700,
    fontSize: 13,
    padding: "9px 20px",
    cursor: "pointer",
    letterSpacing: "0.04em",
    boxShadow: "0 0 20px rgba(142, 77, 196, 0.35)",
    transition: "opacity 0.2s",
  },
  body: { padding: "24px 28px", maxWidth: 1100, margin: "0 auto" },
  // chat stream
  streamBox: {
    background: T.panel,
    border: `1px solid ${T.panelBorder}`,
    borderRadius: 12,
    padding: "18px 22px",
    marginBottom: 24,
    minHeight: 80,
    fontFamily: T.mono,
    fontSize: 12,
    color: T.textDim,
    lineHeight: 1.7,
    position: "relative",
    overflow: "hidden",
  },
  streamLabel: {
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: "0.12em",
    color: T.textMuted,
    textTransform: "uppercase",
    marginBottom: 10,
    display: "flex",
    alignItems: "center",
    gap: 6,
  },
  dot: (active) => ({
    width: 7,
    height: 7,
    borderRadius: "50%",
    background: active ? T.accentLow : T.textMuted,
    boxShadow: active ? `0 0 8px ${T.accentLow}` : "none",
    animation: active ? "pulse 1.2s ease-in-out infinite" : "none",
  }),
  // risk cards grid
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(310px, 1fr))",
    gap: 16,
    marginBottom: 28,
  },
  card: (severity) => ({
    background: T.panel,
    border: `1px solid ${severity === "critical" ? T.accentDanger : severity === "high" ? T.accent : T.accentWarn}44`,
    borderLeft: `3px solid ${severity === "critical" ? T.accentDanger : severity === "high" ? T.accent : T.accentWarn}`,
    borderRadius: 10,
    padding: "16px 18px",
    display: "flex",
    flexDirection: "column",
    gap: 10,
  }),
  cardHeader: { display: "flex", justifyContent: "space-between", alignItems: "flex-start" },
  cardItem: { fontWeight: 700, fontSize: 14, letterSpacing: "0.01em" },
  cardLoc: { fontSize: 11, color: T.textMuted, marginTop: 2 },
  badge: (severity) => ({
    fontSize: 9,
    fontWeight: 800,
    letterSpacing: "0.1em",
    textTransform: "uppercase",
    padding: "3px 8px",
    borderRadius: 4,
    background: severity === "critical" ? `${T.accentDanger}22` : severity === "high" ? `${T.accent}22` : `${T.accentWarn}22`,
    color: severity === "critical" ? T.accentDanger : severity === "high" ? T.accent : T.accentWarn,
    flexShrink: 0,
  }),
  statRow: { display: "flex", gap: 12, flexWrap: "wrap" },
  stat: (color) => ({
    flex: 1,
    minWidth: 80,
    background: `${color}11`,
    borderRadius: 6,
    padding: "7px 10px",
  }),
  statLabel: { fontSize: 9, color: T.textMuted, letterSpacing: "0.08em", textTransform: "uppercase" },
  statValue: (color) => ({ fontSize: 16, fontWeight: 800, color, fontFamily: T.mono, marginTop: 2 }),
  divider: { height: 1, background: T.panelBorder, borderRadius: 1 },
  transferBox: {
    background: `${T.accentLow}0d`,
    border: `1px solid ${T.accentLow}33`,
    borderRadius: 7,
    padding: "10px 12px",
  },
  transferTitle: { fontSize: 10, fontWeight: 700, color: T.accentLow, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 6 },
  transferItem: { fontSize: 12, color: T.textDim, lineHeight: 1.6 },
  noRisk: {
    textAlign: "center",
    color: T.textMuted,
    padding: "40px 0",
    fontSize: 14,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: "0.1em",
    textTransform: "uppercase",
    color: T.textMuted,
    marginBottom: 14,
    display: "flex",
    alignItems: "center",
    gap: 8,
  },
  pill: (color) => ({
    display: "inline-block",
    fontSize: 9,
    fontWeight: 800,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    padding: "2px 7px",
    borderRadius: 99,
    background: `${color}22`,
    color,
  }),
  errorBox: {
    background: `${T.accentDanger}11`,
    border: `1px solid ${T.accentDanger}44`,
    borderRadius: 8,
    padding: "14px 18px",
    color: T.accentDanger,
    fontSize: 13,
  },
};

// ─── helpers ──────────────────────────────────────────────────────────────────
function severityOf(daysUntilStockout, daysUntilDelivery) {
  const gap = daysUntilDelivery - daysUntilStockout;
  if (daysUntilStockout <= 0) return "critical";
  if (gap > 10 || daysUntilStockout < 5) return "critical";
  if (gap > 3 || daysUntilStockout < 14) return "high";
  return "medium";
}

function SeverityIcon({ s }) {
  return s === "critical" ? "🔴" : s === "high" ? "🟠" : "🟡";
}

// ─── main component ───────────────────────────────────────────────────────────
export default function InventoryStrategist() {
  const [stream, setStream]   = useState("");      // raw agent thought stream
  const [risks, setRisks]     = useState(null);    // parsed risk objects
  const [running, setRunning] = useState(false);
  const [error, setError]     = useState(null);
  const streamRef = useRef(null);

  // auto-scroll stream box
  useEffect(() => {
    if (streamRef.current) streamRef.current.scrollTop = streamRef.current.scrollHeight;
  }, [stream]);

  async function runAgent() {
    setRunning(true);
    setStream("");
    setRisks(null);
    setError(null);

    const systemPrompt = `You are an Inventory Strategist AI specialising in stockout-risk detection.

You have access to the frePPLe MCP server. Use it to:
1. Fetch ALL buffers (input/buffer/) — these give you item × location onhand quantities.
2. Fetch purchase orders (input/purchaseorder/) — look at enddate (= delivery date) and which item+location they replenish.
3. Fetch distribution orders (input/distributionorder/) — inbound transfers that also act as replenishment.
4. Using demand data or reasonable assumptions (daily burn ≈ onhand / 30 for items with upcoming orders), identify items where onhand will hit zero BEFORE the next inbound delivery arrives.
5. For each at-risk item-location, check if neighboring locations hold excess stock (onhand above their own near-term needs) and suggest an inter-location transfer.

Return your analysis as a JSON block (and ONLY this, wrapped in \`\`\`json ... \`\`\`) with this exact shape:

{
  "risks": [
    {
      "item": "string",
      "location": "string",
      "onhand": number,
      "daily_burn_estimate": number,
      "days_until_stockout": number,
      "next_delivery_date": "YYYY-MM-DD or null",
      "next_delivery_qty": number or null,
      "days_until_delivery": number or null,
      "severity": "critical|high|medium",
      "gap_days": number or null,
      "transfer_suggestions": [
        {
          "from_location": "string",
          "available_qty": number,
          "recommended_transfer_qty": number,
          "rationale": "string"
        }
      ]
    }
  ],
  "summary": "2-3 sentence executive summary"
}

Think step by step, fetching data as needed. Only include items with a genuine stockout risk (days_until_stockout < days_until_delivery, OR onhand is 0/near-zero with no delivery coming).`;

    try {
      // Use same-origin proxy to avoid browser CORS and keep API key server-side.
      const res = await fetch("/api/anthropic-messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 4096,
          system: systemPrompt,
          messages: [{ role: "user", content: "Run the stockout risk analysis now. Fetch all the data you need from frePPLe, reason through it, then return the JSON." }],
          tools: [
            {
              type: "mcp_toolset",
              mcp_server_name: "frepple",
            },
          ],
          mcp_servers: [
            { type: "url", url: "https://mcp.frepple.com/mcp", name: "frepple" }
          ],
        }),
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`API ${res.status}: ${errText}`);
      }

      const data = await res.json();

      // accumulate all text blocks into the stream display
      let fullText = "";
      for (const block of data.content) {
        if (block.type === "text") {
          fullText += block.text;
          setStream(fullText);
        } else if (block.type === "mcp_tool_use") {
          setStream((p) => p + `\n[→ tool: ${block.name}]\n`);
        } else if (block.type === "mcp_tool_result") {
          const preview = JSON.stringify(block.content).slice(0, 120);
          setStream((p) => p + `[← result: ${preview}...]\n`);
        }
      }

      // extract JSON
      const jsonMatch = fullText.match(/```json\s*([\s\S]*?)```/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[1].trim());
        setRisks(parsed);
      } else {
        // try naked JSON
        const nakMatch = fullText.match(/\{[\s\S]*"risks"[\s\S]*\}/);
        if (nakMatch) setRisks(JSON.parse(nakMatch[0]));
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setRunning(false);
    }
  }

  const critCount  = risks?.risks?.filter((r) => r.severity === "critical").length ?? 0;
  const highCount  = risks?.risks?.filter((r) => r.severity === "high").length    ?? 0;
  const medCount   = risks?.risks?.filter((r) => r.severity === "medium").length  ?? 0;

  return (
    <div style={S.root}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;600;700;800&family=JetBrains+Mono:wght@400;600&display=swap');
        @keyframes pulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:0.5;transform:scale(0.85)} }
        @keyframes fadeUp { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
      `}</style>

      {/* Header */}
      <div style={S.header}>
        <div style={S.headerIcon}>📦</div>
        <div style={S.headerText}>
          <div style={S.headerTitle}>Inventory Strategist</div>
          <div style={S.headerSub}>Stockout Risk Agent · frePPLe live data</div>
        </div>

        {risks && (
          <div style={{ display: "flex", gap: 8, marginRight: 12 }}>
            {critCount > 0 && <span style={S.pill(T.accentDanger)}>{critCount} Critical</span>}
            {highCount > 0 && <span style={S.pill(T.accent)}>{highCount} High</span>}
            {medCount  > 0 && <span style={S.pill(T.accentWarn)}>{medCount} Medium</span>}
          </div>
        )}

        <button style={{ ...S.runBtn, opacity: running ? 0.6 : 1 }} onClick={runAgent} disabled={running}>
          {running ? "Analysing…" : risks ? "Re-run" : "Run Analysis"}
        </button>
      </div>

      <div style={S.body}>
        {/* Agent thought stream */}
        {(stream || running) && (
          <div style={S.streamBox} ref={streamRef}>
            <div style={S.streamLabel}>
              <span style={S.dot(running)} />
              Agent reasoning stream
            </div>
            <pre style={{ margin: 0, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
              {stream || "Connecting to frePPLe MCP…"}
            </pre>
          </div>
        )}

        {/* Error */}
        {error && <div style={S.errorBox}>⚠ {error}</div>}

        {/* Summary */}
        {risks?.summary && (
          <div style={{ ...S.streamBox, fontFamily: T.sans, fontSize: 13, color: T.textDim, marginBottom: 24 }}>
            <div style={S.streamLabel}><span>📋</span> Executive Summary</div>
            {risks.summary}
          </div>
        )}

        {/* Risk cards */}
        {risks?.risks?.length > 0 && (
          <>
            <div style={S.sectionTitle}>
              <span>⚡</span> At-Risk Items ({risks.risks.length})
            </div>
            <div style={S.grid}>
              {risks.risks
                .sort((a, b) => {
                  const order = { critical: 0, high: 1, medium: 2 };
                  return (order[a.severity] ?? 3) - (order[b.severity] ?? 3);
                })
                .map((r, i) => (
                  <RiskCard key={i} r={r} />
                ))}
            </div>
          </>
        )}

        {risks?.risks?.length === 0 && (
          <div style={S.noRisk}>✅ No stockout risks detected — all items have replenishment arriving before depletion.</div>
        )}

        {/* Idle state */}
        {!risks && !running && !error && (
          <div style={{ textAlign: "center", paddingTop: 60, color: T.textMuted }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>📦</div>
            <div style={{ fontSize: 14 }}>Click <strong style={{ color: T.accent }}>Run Analysis</strong> to fetch live frePPLe data<br />and identify stockout risks across all locations.</div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Risk Card ────────────────────────────────────────────────────────────────
function RiskCard({ r }) {
  const sev = r.severity ?? "medium";
  const sevColor = sev === "critical" ? T.accentDanger : sev === "high" ? T.accent : T.accentWarn;

  return (
    <div style={{ ...S.card(sev), animation: "fadeUp 0.35s ease both" }}>
      {/* header */}
      <div style={S.cardHeader}>
        <div>
          <div style={S.cardItem}><SeverityIcon s={sev} /> {r.item}</div>
          <div style={S.cardLoc}>📍 {r.location}</div>
        </div>
        <div style={S.badge(sev)}>{sev}</div>
      </div>

      <div style={S.divider} />

      {/* stats */}
      <div style={S.statRow}>
        <div style={S.stat(sevColor)}>
          <div style={S.statLabel}>On Hand</div>
          <div style={S.statValue(sevColor)}>{r.onhand ?? "—"}</div>
        </div>
        <div style={S.stat(T.textDim)}>
          <div style={S.statLabel}>Daily Burn</div>
          <div style={S.statValue(T.textDim)}>{r.daily_burn_estimate != null ? r.daily_burn_estimate.toFixed(1) : "—"}</div>
        </div>
        <div style={S.stat(sevColor)}>
          <div style={S.statLabel}>Days Left</div>
          <div style={S.statValue(sevColor)}>{r.days_until_stockout != null ? Math.max(0, r.days_until_stockout) : "—"}</div>
        </div>
      </div>

      {/* delivery info */}
      {r.next_delivery_date ? (
        <div style={{ fontSize: 11, color: T.textMuted, display: "flex", justifyContent: "space-between" }}>
          <span>📅 Next delivery: <strong style={{ color: T.textDim }}>{r.next_delivery_date}</strong> (+{r.next_delivery_qty ?? "?"} units)</span>
          {r.gap_days != null && (
            <span style={{ color: r.gap_days > 0 ? T.accentDanger : T.accentLow }}>
              {r.gap_days > 0 ? `⚠ ${r.gap_days}d gap` : "✓ covered"}
            </span>
          )}
        </div>
      ) : (
        <div style={{ fontSize: 11, color: T.accentDanger }}>🚨 No replenishment scheduled</div>
      )}

      {/* transfer suggestions */}
      {r.transfer_suggestions?.length > 0 && (
        <>
          <div style={S.divider} />
          <div style={S.transferBox}>
            <div style={S.transferTitle}>🔁 Transfer Suggestions</div>
            {r.transfer_suggestions.map((t, j) => (
              <div key={j} style={S.transferItem}>
                <strong style={{ color: T.accentLow }}>{t.from_location}</strong>
                {" → "}{t.recommended_transfer_qty} units
                {t.available_qty != null && <span style={{ color: T.textMuted }}> (avail: {t.available_qty})</span>}
                {t.rationale && <div style={{ color: T.textMuted, fontSize: 11, marginTop: 2 }}>{t.rationale}</div>}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
