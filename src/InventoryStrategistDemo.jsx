/**
 * InventoryStrategistDemo.jsx
 * ---------------------------------------------------------------------------
 * Drop-in React component — no props, no external deps, no API calls.
 * Uses the real frePPLe data analysed on 30 Mar 2026.
 *
 * Usage:
 *   import InventoryStrategistDemo from './InventoryStrategistDemo';
 *   <InventoryStrategistDemo />
 *
 * Requires only React (useState). Tailwind is NOT required — all styles
 * are inline or via a <style> tag injected once on mount.
 * ---------------------------------------------------------------------------
 */

import { useState, useEffect } from "react";

// ─── Data ──────────────────────────────────────────────────────────────────
const RISKS = [
  {
    id: 1,
    item: "Grinded wooden panel",
    location: "Factory",
    severity: "critical",
    onhand: 0,
    dailyBurn: 4,
    daysLeft: 0,
    nextDeliveryDate: null,
    nextDeliveryQty: null,
    delayDays: null,
    criticality: null,
    poRef: null,
    gapDays: null,
    transferSuggestions: [
      {
        action: "Expedite processing",
        from: "Wooden panel @ factory",
        qty: 100,
        rationale:
          "100 units of raw wooden panel are on-hand. Grinding lead time ≈1 day — covers ~25 units of immediate demand.",
      },
    ],
    downstreamImpact: ["Round table", "Square table"],
  },
  {
    id: 2,
    item: "Wooden panel",
    location: "Factory",
    severity: "critical",
    onhand: 100,
    dailyBurn: 13,
    daysLeft: 8,
    nextDeliveryDate: "30 Mar 2026",
    nextDeliveryQty: 100,
    delayDays: 53,
    criticality: 53,
    poRef: "PO#1",
    gapLabel: "53d delayed",
    gapType: "danger",
    transferSuggestions: [
      {
        action: "Transfer from warehouse",
        from: "Warehouse",
        qty: 10,
        rationale:
          "10 units on-hand at warehouse. Covers ~3 weeks of table production. Next bulk delivery (PO#884) not until 25 May.",
      },
    ],
    downstreamImpact: ["Round table", "Square table", "Grinded wooden panel"],
  },
  {
    id: 3,
    item: "Wooden beam",
    location: "Factory",
    severity: "high",
    onhand: 20,
    dailyBurn: 100,
    daysLeft: 5,
    nextDeliveryDate: "3 Apr 2026",
    nextDeliveryQty: 100,
    delayDays: 15,
    criticality: 7,
    poRef: "PO#2",
    gapLabel: "15d delayed",
    gapType: "warn",
    transferSuggestions: [
      {
        action: "Expedite PO#852",
        from: "Wood supplier",
        qty: 700,
        rationale:
          "PO#852 (700 units) starts 30 Mar, arrives 6 Apr. Expedite by 2 days to close the gap. No excess beam at neighbouring locations.",
      },
    ],
    downstreamImpact: ["Chair", "Chair leg", "Table leg"],
  },
  {
    id: 4,
    item: "Screws",
    location: "Factory",
    severity: "high",
    onhand: 500,
    dailyBurn: 33,
    daysLeft: 15,
    nextDeliveryDate: "30 Mar 2026",
    nextDeliveryQty: 100,
    delayDays: 21,
    criticality: 21,
    poRef: "PO#3",
    gapLabel: "21d delayed · crit 21",
    gapType: "warn",
    transferSuggestions: [
      {
        action: "Monitor PO#3",
        from: "Screw supplier",
        qty: 3000,
        rationale:
          "PO#846 (3,000 units) arrives 20 Apr — sufficient if PO#3 lands today. Any further delay stops chair & table production.",
      },
    ],
    downstreamImpact: ["Chair", "Round table", "Square table"],
  },
  {
    id: 5,
    item: "Cushion",
    location: "Factory",
    severity: "medium",
    onhand: 40,
    dailyBurn: 7,
    daysLeft: 6,
    nextDeliveryDate: "3 Apr 2026",
    nextDeliveryQty: 100,
    delayDays: 13,
    criticality: 12,
    poRef: "PO#4",
    gapLabel: "13d delayed · crit 12",
    gapType: "warn",
    transferSuggestions: [
      {
        action: "Monitor closely",
        from: "—",
        qty: null,
        rationale:
          "On-hand covers until ~5 Apr; PO#4 arrives 3 Apr. Gap is tight — watch chair demand peaks (49 + 46 units pegged). No excess at other locations.",
      },
    ],
    downstreamImpact: ["Chair"],
  },
];

const HEALTHY = [
  { item: "Chair", detail: "Factory 4 · Shop 1 & 2 · Warehouse · PO#821 covers demand" },
  { item: "Round table", detail: "Factory 20 · shops · warehouse · well covered" },
  { item: "Square table", detail: "Factory 10 · shops · warehouse · stable" },
  { item: "Chair leg / Table leg", detail: "Factory 30 / 40 · no near-term risk" },
];

const Y3 = {
  brand: "#6b2d91",
  brandBright: "#8e4dc4",
  brandDim: "#4a1f68",
  bg: "#100818",
  surface: "#1c1028",
  border: "#3d2858",
  text: "#f4eef9",
  muted: "#b8a3c9",
};

// ─── Colour helpers ─────────────────────────────────────────────────────────
const SEV = {
  critical: {
    border: "#ef4444",
    badgeBg: "#fef2f2",
    badgeText: "#991b1b",
    label: "Critical",
    dot: "#ef4444",
  },
  high: {
    border: "#f97316",
    badgeBg: "#fff7ed",
    badgeText: "#9a3412",
    label: "High",
    dot: "#f97316",
  },
  medium: {
    border: "#eab308",
    badgeBg: "#fefce8",
    badgeText: "#854d0e",
    label: "Medium",
    dot: "#eab308",
  },
};

const FILTER_OPTS = [
  { key: "all", label: "All risks (5)" },
  { key: "critical", label: "Critical (2)" },
  { key: "high", label: "High (2)" },
  { key: "medium", label: "Medium (1)" },
];

// ─── Sub-components ─────────────────────────────────────────────────────────
function KpiCard({ label, value, color }) {
  return (
    <div
      style={{
        background: "rgba(142, 77, 196, 0.12)",
        border: `1px solid ${Y3.border}`,
        borderRadius: 10,
        padding: "12px 16px",
        flex: "1 1 100px",
        minWidth: 90,
      }}
    >
      <div style={{ fontSize: 11, color: Y3.muted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>
        {label}
      </div>
      <div style={{ fontSize: 24, fontWeight: 700, color }}>{value}</div>
    </div>
  );
}

function FilterBtn({ label, active, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        background: active ? Y3.brand : "rgba(142, 77, 196, 0.12)",
        color: active ? Y3.text : Y3.muted,
        border: `1px solid ${Y3.border}`,
        borderRadius: 8,
        padding: "6px 14px",
        fontSize: 12,
        fontWeight: 600,
        cursor: "pointer",
        transition: "all 0.15s",
        letterSpacing: "0.01em",
      }}
    >
      {label}
    </button>
  );
}

function StatBox({ label, value, color }) {
  return (
    <div style={{ background: "rgba(142, 77, 196, 0.1)", border: `1px solid ${Y3.border}`, borderRadius: 8, padding: "8px 10px", flex: "1 1 80px" }}>
      <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.06em", color: Y3.muted }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 700, color: color || Y3.text, marginTop: 2 }}>{value}</div>
    </div>
  );
}

function GapPill({ label, type }) {
  const colors = {
    danger: { bg: "#fef2f2", text: "#991b1b" },
    warn: { bg: "#fffbeb", text: "#92400e" },
    ok: { bg: "#f0fdf4", text: "#166534" },
  };
  const c = colors[type] || colors.warn;
  return (
    <span
      style={{
        fontSize: 11,
        fontWeight: 600,
        padding: "3px 10px",
        borderRadius: 99,
        background: c.bg,
        color: c.text,
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </span>
  );
}

function RiskCard({ risk }) {
  const [open, setOpen] = useState(false);
  const sev = SEV[risk.severity];

  const daysColor =
    risk.daysLeft === 0 ? "#ef4444" : risk.daysLeft <= 5 ? "#f97316" : risk.daysLeft <= 14 ? "#eab308" : Y3.text;

  return (
    <div
      style={{
        background: Y3.surface,
        border: `1px solid ${Y3.border}`,
        borderLeft: `4px solid ${sev.border}`,
        borderRadius: 12,
        overflow: "hidden",
        transition: "box-shadow 0.2s",
      }}
    >
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", padding: "16px 18px 12px" }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 700, color: Y3.text }}>{risk.item}</div>
          <div style={{ fontSize: 12, color: Y3.muted, marginTop: 3 }}>📍 {risk.location}</div>
        </div>
        <span
          style={{
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            padding: "4px 10px",
            borderRadius: 99,
            background: sev.badgeBg,
            color: sev.badgeText,
            flexShrink: 0,
          }}
        >
          {sev.label}
        </span>
      </div>

      {/* Stats */}
      <div style={{ display: "flex", gap: 8, padding: "0 18px 14px", flexWrap: "wrap" }}>
        <StatBox label="On hand" value={risk.onhand} color={risk.onhand === 0 ? "#ef4444" : "#111827"} />
        <StatBox label="Daily burn" value={`~${risk.dailyBurn}`} color="#6b7280" />
        <StatBox label="Days left" value={risk.daysLeft === 0 ? "0 ⚠" : `~${risk.daysLeft}`} color={daysColor} />
      </div>

      {/* Divider */}
      <div style={{ height: 1, background: Y3.border, margin: "0 18px" }} />

      {/* Delivery row */}
      <div style={{ padding: "10px 18px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
        {risk.nextDeliveryDate ? (
          <span style={{ fontSize: 12, color: Y3.muted }}>
            📅 <strong style={{ color: Y3.text }}>{risk.poRef}</strong> arriving{" "}
            <strong style={{ color: Y3.text }}>{risk.nextDeliveryDate}</strong>{" "}
            (+{risk.nextDeliveryQty} units)
          </span>
        ) : (
          <span
            style={{
              fontSize: 12,
              color: "#fca5a5",
              background: "rgba(248, 113, 113, 0.14)",
              borderRadius: 8,
              padding: "7px 12px",
              display: "block",
              width: "100%",
            }}
          >
            🚨 No replenishment scheduled
          </span>
        )}
        {risk.gapLabel && <GapPill label={risk.gapLabel} type={risk.gapType} />}
      </div>

      {/* Transfer suggestions */}
      {risk.transferSuggestions.length > 0 && (
        <div style={{ margin: "0 18px 16px" }}>
          <div
            style={{
              background: "rgba(52, 211, 153, 0.12)",
              border: "1px solid rgba(52, 211, 153, 0.35)",
              borderRadius: 8,
              padding: "10px 14px",
            }}
          >
            <div
              style={{
                fontSize: 10,
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                color: "#166534",
                marginBottom: 6,
              }}
            >
              🔁 Suggested action
            </div>
            {risk.transferSuggestions.map((t, i) => (
              <div key={i} style={{ fontSize: 12, color: Y3.text, lineHeight: 1.65 }}>
                {t.qty && (
                  <span>
                    <strong style={{ color: "#15803d" }}>{t.from}</strong>
                    {" → "}
                    {t.qty} units.{" "}
                  </span>
                )}
                {t.rationale}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Downstream toggle */}
      {risk.downstreamImpact?.length > 0 && (
        <div style={{ borderTop: `1px solid ${Y3.border}` }}>
          <button
            onClick={() => setOpen((v) => !v)}
            style={{
              width: "100%",
              textAlign: "left",
              background: "none",
              border: "none",
              padding: "9px 18px",
              fontSize: 12,
              color: Y3.muted,
              cursor: "pointer",
              display: "flex",
              justifyContent: "space-between",
            }}
          >
            <span>⚡ Downstream impact: {risk.downstreamImpact.join(", ")}</span>
            <span>{open ? "▲" : "▼"}</span>
          </button>
          {open && (
            <div style={{ padding: "4px 18px 14px", fontSize: 12, color: Y3.text, lineHeight: 1.7 }}>
              A stockout of <strong>{risk.item}</strong> will halt production of:{" "}
              <strong style={{ color: "#dc2626" }}>{risk.downstreamImpact.join(", ")}</strong>.
              These items share the same supply chain path — prioritise resolution within{" "}
              <strong>{Math.max(1, risk.daysLeft - 1)} day{risk.daysLeft !== 2 ? "s" : ""}</strong>.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main component ─────────────────────────────────────────────────────────
export default function InventoryStrategistDemo() {
  const [filter, setFilter] = useState("all");

  const visible = filter === "all" ? RISKS : RISKS.filter((r) => r.severity === filter);
  const critCount = RISKS.filter((r) => r.severity === "critical").length;
  const highCount = RISKS.filter((r) => r.severity === "high").length;
  const medCount  = RISKS.filter((r) => r.severity === "medium").length;

  return (
    <div
      style={{
        fontFamily:
          "'DM Sans', 'Inter', 'Segoe UI', system-ui, -apple-system, sans-serif",
        background: Y3.bg,
        minHeight: "100vh",
        color: Y3.text,
      }}
    >
      {/* ── Sticky header ── */}
      <div
        style={{
          position: "sticky",
          top: 0,
          zIndex: 20,
          background: "linear-gradient(90deg, rgba(74,31,104,0.95) 0%, rgba(28,16,40,0.95) 55%, rgba(107,45,145,0.35) 100%)",
          backdropFilter: "blur(8px)",
          borderBottom: `1px solid ${Y3.border}`,
          padding: "14px 28px",
          display: "flex",
          alignItems: "center",
          gap: 14,
        }}
      >
        <div
          style={{
            width: 38,
            height: 38,
            borderRadius: 10,
            background: `linear-gradient(135deg, ${Y3.brandBright}, ${Y3.brand})`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 18,
            flexShrink: 0,
          }}
        >
          📦
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: Y3.text, letterSpacing: "0.01em" }}>
            Inventory Strategist — Stockout Risk
          </div>
          <div style={{ fontSize: 12, color: Y3.muted, marginTop: 2 }}>
            Y3 live data · 30 Mar 2026 · 19 buffers · 4 locations
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {critCount > 0 && (
            <span style={{ fontSize: 11, fontWeight: 700, padding: "4px 10px", borderRadius: 99, background: "#fef2f2", color: "#991b1b" }}>
              {critCount} Critical
            </span>
          )}
          {highCount > 0 && (
            <span style={{ fontSize: 11, fontWeight: 700, padding: "4px 10px", borderRadius: 99, background: "#fff7ed", color: "#9a3412" }}>
              {highCount} High
            </span>
          )}
          {medCount > 0 && (
            <span style={{ fontSize: 11, fontWeight: 700, padding: "4px 10px", borderRadius: 99, background: "#fefce8", color: "#854d0e" }}>
              {medCount} Medium
            </span>
          )}
        </div>
      </div>

      {/* ── Body ── */}
      <div style={{ maxWidth: 860, margin: "0 auto", padding: "28px 24px 48px" }}>

        {/* Summary banner */}
        <div
          style={{
            background: Y3.surface,
            border: `1px solid ${Y3.border}`,
            borderLeft: `4px solid ${Y3.brandBright}`,
            borderRadius: 12,
            padding: "16px 20px",
            marginBottom: 24,
            fontSize: 13,
            color: Y3.text,
            lineHeight: 1.7,
          }}
        >
          <strong style={{ color: Y3.text }}>5 items are at genuine stockout risk</strong> — on-hand stock depletes before
          the next replenishment arrives. The most urgent is{" "}
          <strong style={{ color: "#dc2626" }}>Grinded wooden panel @ factory</strong> (zero stock, no delivery scheduled) and{" "}
          <strong style={{ color: "#dc2626" }}>Wooden panel @ factory</strong> (PO#1 53 days delayed, expiry risk). Transfers from{" "}
          <strong>warehouse</strong> and expedited supplier orders can bridge 3 of the 5 gaps immediately.
        </div>

        {/* KPI row */}
        <div style={{ display: "flex", gap: 10, marginBottom: 24, flexWrap: "wrap" }}>
          <KpiCard label="Critical" value={critCount} color="#ef4444" />
          <KpiCard label="High risk" value={highCount} color="#f97316" />
          <KpiCard label="Medium" value={medCount} color="#eab308" />
          <KpiCard label="Transfers available" value={3} color="#16a34a" />
          <KpiCard label="Locations scanned" value={4} color={Y3.brandBright} />
          <KpiCard label="Buffers analysed" value={19} color={Y3.muted} />
        </div>

        {/* Filter row */}
        <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
          {FILTER_OPTS.map((f) => (
            <FilterBtn
              key={f.key}
              label={f.label}
              active={filter === f.key}
              onClick={() => setFilter(f.key)}
            />
          ))}
        </div>

        {/* Section label */}
        <div
          style={{
            fontSize: 11,
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            color: Y3.muted,
            marginBottom: 14,
          }}
        >
          At-risk items ({visible.length})
        </div>

        {/* Risk cards */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {visible.map((r) => (
            <RiskCard key={r.id} risk={r} />
          ))}
          {visible.length === 0 && (
            <div style={{ textAlign: "center", color: Y3.muted, padding: "40px 0", fontSize: 14 }}>
              No items matching this filter.
            </div>
          )}
        </div>

        {/* Healthy stock section */}
        <div style={{ marginTop: 32, paddingTop: 24, borderTop: `1px solid ${Y3.border}` }}>
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              color: Y3.muted,
              marginBottom: 14,
            }}
          >
            Healthy stock — no risk detected
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 10 }}>
            {HEALTHY.map((h) => (
              <div
                key={h.item}
                style={{
                  background: Y3.surface,
                  border: `1px solid ${Y3.border}`,
                  borderLeft: "3px solid #16a34a",
                  borderRadius: 10,
                  padding: "12px 14px",
                  fontSize: 12,
                  color: Y3.text,
                }}
              >
                <div style={{ fontWeight: 700, color: Y3.text, marginBottom: 4 }}>✅ {h.item}</div>
                <div style={{ color: Y3.muted, lineHeight: 1.6 }}>{h.detail}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Supply chain note */}
        <div
          style={{
            marginTop: 24,
            background: "rgba(245, 158, 11, 0.14)",
            border: "1px solid rgba(245, 158, 11, 0.35)",
            borderRadius: 12,
            padding: "14px 18px",
            fontSize: 12,
            color: "#fcd34d",
            lineHeight: 1.7,
          }}
        >
          <strong>⚠ Supply chain cascade risk:</strong> Wooden beam → Wooden panel → Grinded wooden panel are all on the
          same path. A stockout at any upstream stage propagates downstream within 1–2 days. Resolve in order:{" "}
          <strong>wooden beam first</strong>, then panel, then grinding.
        </div>

        {/* Footer */}
        <div
          style={{
            marginTop: 28,
            fontSize: 11,
            color: Y3.muted,
            textAlign: "center",
            letterSpacing: "0.04em",
          }}
        >
          Inventory Strategy Agent
        </div>
      </div>
    </div>
  );
}
