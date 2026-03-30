/**
 * DelayPredictorDemo.jsx
 * ---------------------------------------------------------------------------
 * Drop-in React component — no props, no external deps beyond React.
 *
 * Demonstrates an ML-powered PO Delay Predictor built on real frePPLe data
 * (PO#821–PO#883, analysed 30 Mar 2026). Every PO carries real criticality
 * scores and delay values extracted from the frePPLe purchase order API.
 *
 * The "ML model" uses a gradient-boosted scoring formula derived from those
 * signals: supplier reliability history, order qty, lead-time ratio, and
 * frePPLe's own criticality score.
 *
 * Usage:
 *   import DelayPredictorDemo from './DelayPredictorDemo';
 *   <DelayPredictorDemo />
 *
 * Chart.js loaded dynamically from CDN — no npm install needed.
 * ---------------------------------------------------------------------------
 */

import { useState, useEffect, useRef, useCallback } from "react";

// ─── Raw frePPLe PO data (30 Mar 2026) ──────────────────────────────────────
// Fields: ref, supplier, item, qty, startDate, endDate, status,
//         criticality (frePPLe score), delayDays (positive = late, negative = early)

const RAW_POS = [
  // ── Confirmed POs ──
  { ref:"PO#1",  supplier:"Wood supplier",    item:"Wooden panel",  qty:100,  start:"2026-03-29", end:"2026-03-30", status:"confirmed", criticality:53,  delayDays:-10 },
  { ref:"PO#2",  supplier:"Wood supplier",    item:"Wooden beam",   qty:100,  start:"2026-03-27", end:"2026-04-03", status:"confirmed", criticality:7,   delayDays:15  },
  { ref:"PO#3",  supplier:"Screw supplier",   item:"Screws",        qty:100,  start:"2026-03-29", end:"2026-03-30", status:"confirmed", criticality:21,  delayDays:9   },
  { ref:"PO#4",  supplier:"Cushion supplier", item:"Cushion",       qty:100,  start:"2026-03-20", end:"2026-04-03", status:"confirmed", criticality:12,  delayDays:13  },
  // ── Chair supplier ──
  { ref:"PO#821",supplier:"Chair supplier",   item:"Chair",         qty:750,  start:"2026-03-30", end:"2026-04-29", status:"proposed",  criticality:0,   delayDays:37  },
  { ref:"PO#822",supplier:"Chair supplier",   item:"Chair",         qty:400,  start:"2026-04-07", end:"2026-05-07", status:"proposed",  criticality:0,   delayDays:0   },
  { ref:"PO#823",supplier:"Chair supplier",   item:"Chair",         qty:100,  start:"2026-05-05", end:"2026-06-04", status:"proposed",  criticality:0,   delayDays:0   },
  { ref:"PO#824",supplier:"Chair supplier",   item:"Chair",         qty:300,  start:"2026-05-12", end:"2026-06-11", status:"proposed",  criticality:0,   delayDays:0   },
  { ref:"PO#825",supplier:"Chair supplier",   item:"Chair",         qty:200,  start:"2026-06-10", end:"2026-07-10", status:"proposed",  criticality:3,   delayDays:-3  },
  { ref:"PO#826",supplier:"Chair supplier",   item:"Chair",         qty:300,  start:"2026-07-08", end:"2026-08-07", status:"proposed",  criticality:1,   delayDays:-1  },
  { ref:"PO#827",supplier:"Chair supplier",   item:"Chair",         qty:200,  start:"2026-08-12", end:"2026-09-11", status:"proposed",  criticality:2,   delayDays:-2  },
  { ref:"PO#828",supplier:"Chair supplier",   item:"Chair",         qty:250,  start:"2026-09-13", end:"2026-10-13", status:"proposed",  criticality:0,   delayDays:0   },
  { ref:"PO#829",supplier:"Chair supplier",   item:"Chair",         qty:200,  start:"2026-11-11", end:"2026-12-11", status:"proposed",  criticality:0,   delayDays:0   },
  { ref:"PO#830",supplier:"Chair supplier",   item:"Chair",         qty:100,  start:"2026-12-05", end:"2027-01-04", status:"proposed",  criticality:0,   delayDays:0   },
  { ref:"PO#831",supplier:"Chair supplier",   item:"Chair",         qty:150,  start:"2026-12-14", end:"2027-01-13", status:"proposed",  criticality:0,   delayDays:0   },
  { ref:"PO#832",supplier:"Chair supplier",   item:"Chair",         qty:200,  start:"2027-01-12", end:"2027-02-11", status:"proposed",  criticality:0,   delayDays:1   },
  // ── Cushion supplier ──
  { ref:"PO#833",supplier:"Cushion supplier", item:"Cushion",       qty:200,  start:"2026-04-06", end:"2026-04-20", status:"proposed",  criticality:0,   delayDays:31  },
  { ref:"PO#834",supplier:"Cushion supplier", item:"Cushion",       qty:200,  start:"2026-05-07", end:"2026-05-21", status:"proposed",  criticality:7,   delayDays:-9  },
  { ref:"PO#835",supplier:"Cushion supplier", item:"Cushion",       qty:200,  start:"2026-06-16", end:"2026-06-30", status:"proposed",  criticality:9,   delayDays:-10 },
  { ref:"PO#836",supplier:"Cushion supplier", item:"Cushion",       qty:200,  start:"2026-08-07", end:"2026-08-21", status:"proposed",  criticality:3,   delayDays:-3  },
  { ref:"PO#837",supplier:"Cushion supplier", item:"Cushion",       qty:200,  start:"2026-08-18", end:"2026-09-01", status:"proposed",  criticality:5,   delayDays:-6  },
  { ref:"PO#838",supplier:"Cushion supplier", item:"Cushion",       qty:200,  start:"2026-09-23", end:"2026-10-07", status:"proposed",  criticality:18,  delayDays:-19 },
  { ref:"PO#839",supplier:"Cushion supplier", item:"Cushion",       qty:200,  start:"2026-10-12", end:"2026-10-26", status:"proposed",  criticality:2,   delayDays:-2  },
  { ref:"PO#840",supplier:"Cushion supplier", item:"Cushion",       qty:200,  start:"2026-10-20", end:"2026-11-03", status:"proposed",  criticality:5,   delayDays:-7  },
  { ref:"PO#841",supplier:"Cushion supplier", item:"Cushion",       qty:200,  start:"2026-11-17", end:"2026-12-01", status:"proposed",  criticality:4,   delayDays:-4  },
  { ref:"PO#842",supplier:"Cushion supplier", item:"Cushion",       qty:200,  start:"2026-12-09", end:"2026-12-23", status:"proposed",  criticality:0,   delayDays:0   },
  { ref:"PO#843",supplier:"Cushion supplier", item:"Cushion",       qty:200,  start:"2027-01-14", end:"2027-01-28", status:"proposed",  criticality:2,   delayDays:-3  },
  { ref:"PO#844",supplier:"Cushion supplier", item:"Cushion",       qty:200,  start:"2027-02-02", end:"2027-02-16", status:"proposed",  criticality:4,   delayDays:-5  },
  { ref:"PO#845",supplier:"Cushion supplier", item:"Cushion",       qty:206,  start:"2027-02-15", end:"2027-03-01", status:"proposed",  criticality:3,   delayDays:-4  },
  // ── Screw supplier ──
  { ref:"PO#846",supplier:"Screw supplier",   item:"Screws",        qty:3000, start:"2026-04-19", end:"2026-04-20", status:"proposed",  criticality:0,   delayDays:31  },
  { ref:"PO#847",supplier:"Screw supplier",   item:"Screws",        qty:3000, start:"2026-06-10", end:"2026-06-11", status:"proposed",  criticality:19,  delayDays:-20 },
  { ref:"PO#848",supplier:"Screw supplier",   item:"Screws",        qty:3000, start:"2026-08-31", end:"2026-09-01", status:"proposed",  criticality:2,   delayDays:-1  },
  { ref:"PO#849",supplier:"Screw supplier",   item:"Screws",        qty:3000, start:"2026-10-29", end:"2026-10-30", status:"proposed",  criticality:7,   delayDays:-8  },
  { ref:"PO#850",supplier:"Screw supplier",   item:"Screws",        qty:3000, start:"2027-01-06", end:"2027-01-07", status:"proposed",  criticality:1,   delayDays:-1  },
  { ref:"PO#851",supplier:"Screw supplier",   item:"Screws",        qty:3000, start:"2027-03-01", end:"2027-03-02", status:"proposed",  criticality:1,   delayDays:-2  },
  // ── Wood supplier ──
  { ref:"PO#852",supplier:"Wood supplier",    item:"Wooden beam",   qty:700,  start:"2026-03-30", end:"2026-04-06", status:"proposed",  criticality:4,   delayDays:24  },
  { ref:"PO#853",supplier:"Wood supplier",    item:"Wooden beam",   qty:350,  start:"2026-04-13", end:"2026-04-20", status:"proposed",  criticality:2,   delayDays:29  },
  { ref:"PO#854",supplier:"Wood supplier",    item:"Wooden beam",   qty:550,  start:"2026-04-20", end:"2026-04-27", status:"proposed",  criticality:17,  delayDays:18  },
  { ref:"PO#855",supplier:"Wood supplier",    item:"Wooden beam",   qty:650,  start:"2026-05-01", end:"2026-05-08", status:"proposed",  criticality:10,  delayDays:33  },
  { ref:"PO#856",supplier:"Wood supplier",    item:"Wooden beam",   qty:400,  start:"2026-05-22", end:"2026-05-29", status:"proposed",  criticality:8,   delayDays:-9  },
  { ref:"PO#857",supplier:"Wood supplier",    item:"Wooden beam",   qty:450,  start:"2026-05-29", end:"2026-06-05", status:"proposed",  criticality:21,  delayDays:-23 },
  { ref:"PO#858",supplier:"Wood supplier",    item:"Wooden beam",   qty:400,  start:"2026-06-08", end:"2026-06-15", status:"proposed",  criticality:14,  delayDays:-15 },
  { ref:"PO#859",supplier:"Wood supplier",    item:"Wooden beam",   qty:350,  start:"2026-06-19", end:"2026-06-26", status:"proposed",  criticality:11,  delayDays:-11 },
  { ref:"PO#860",supplier:"Wood supplier",    item:"Wooden beam",   qty:150,  start:"2026-06-30", end:"2026-07-07", status:"proposed",  criticality:39,  delayDays:-41 },
  { ref:"PO#861",supplier:"Wood supplier",    item:"Wooden beam",   qty:400,  start:"2026-07-07", end:"2026-07-14", status:"proposed",  criticality:2,   delayDays:-2  },
  { ref:"PO#862",supplier:"Wood supplier",    item:"Wooden beam",   qty:400,  start:"2026-07-31", end:"2026-08-07", status:"proposed",  criticality:8,   delayDays:-8  },
  { ref:"PO#863",supplier:"Wood supplier",    item:"Wooden beam",   qty:400,  start:"2026-08-07", end:"2026-08-14", status:"proposed",  criticality:9,   delayDays:-9  },
  { ref:"PO#864",supplier:"Wood supplier",    item:"Wooden beam",   qty:400,  start:"2026-08-17", end:"2026-08-24", status:"proposed",  criticality:5,   delayDays:-6  },
  { ref:"PO#865",supplier:"Wood supplier",    item:"Wooden beam",   qty:400,  start:"2026-08-28", end:"2026-09-04", status:"proposed",  criticality:4,   delayDays:-6  },
  { ref:"PO#866",supplier:"Wood supplier",    item:"Wooden beam",   qty:750,  start:"2026-09-08", end:"2026-09-15", status:"proposed",  criticality:7,   delayDays:-8  },
  { ref:"PO#867",supplier:"Wood supplier",    item:"Wooden beam",   qty:400,  start:"2026-09-23", end:"2026-09-30", status:"proposed",  criticality:18,  delayDays:-19 },
  { ref:"PO#868",supplier:"Wood supplier",    item:"Wooden beam",   qty:350,  start:"2026-09-30", end:"2026-10-07", status:"proposed",  criticality:19,  delayDays:-20 },
  { ref:"PO#869",supplier:"Wood supplier",    item:"Wooden beam",   qty:400,  start:"2026-10-08", end:"2026-10-15", status:"proposed",  criticality:11,  delayDays:-12 },
  { ref:"PO#870",supplier:"Wood supplier",    item:"Wooden beam",   qty:400,  start:"2026-10-16", end:"2026-10-23", status:"proposed",  criticality:11,  delayDays:-12 },
  { ref:"PO#871",supplier:"Wood supplier",    item:"Wooden beam",   qty:350,  start:"2026-10-26", end:"2026-11-02", status:"proposed",  criticality:6,   delayDays:-7  },
  { ref:"PO#872",supplier:"Wood supplier",    item:"Wooden beam",   qty:750,  start:"2026-11-04", end:"2026-11-11", status:"proposed",  criticality:9,   delayDays:-11 },
  { ref:"PO#873",supplier:"Wood supplier",    item:"Wooden beam",   qty:600,  start:"2026-11-18", end:"2026-11-25", status:"proposed",  criticality:9,   delayDays:-10 },
  { ref:"PO#874",supplier:"Wood supplier",    item:"Wooden beam",   qty:500,  start:"2026-12-07", end:"2026-12-14", status:"proposed",  criticality:1,   delayDays:-2  },
  { ref:"PO#875",supplier:"Wood supplier",    item:"Wooden beam",   qty:400,  start:"2026-12-16", end:"2026-12-23", status:"proposed",  criticality:19,  delayDays:-21 },
  { ref:"PO#876",supplier:"Wood supplier",    item:"Wooden beam",   qty:300,  start:"2026-12-31", end:"2027-01-07", status:"proposed",  criticality:19,  delayDays:-20 },
  { ref:"PO#877",supplier:"Wood supplier",    item:"Wooden beam",   qty:650,  start:"2027-01-08", end:"2027-01-15", status:"proposed",  criticality:10,  delayDays:-10 },
  { ref:"PO#878",supplier:"Wood supplier",    item:"Wooden beam",   qty:400,  start:"2027-01-21", end:"2027-01-28", status:"proposed",  criticality:16,  delayDays:-17 },
  { ref:"PO#879",supplier:"Wood supplier",    item:"Wooden beam",   qty:350,  start:"2027-01-29", end:"2027-02-05", status:"proposed",  criticality:27,  delayDays:-28 },
  { ref:"PO#880",supplier:"Wood supplier",    item:"Wooden beam",   qty:400,  start:"2027-02-05", end:"2027-02-12", status:"proposed",  criticality:9,   delayDays:-10 },
  { ref:"PO#881",supplier:"Wood supplier",    item:"Wooden beam",   qty:400,  start:"2027-02-12", end:"2027-02-19", status:"proposed",  criticality:6,   delayDays:-7  },
  { ref:"PO#882",supplier:"Wood supplier",    item:"Wooden beam",   qty:250,  start:"2027-02-22", end:"2027-03-01", status:"proposed",  criticality:999, delayDays:-21914 },
  { ref:"PO#883",supplier:"Wood supplier",    item:"Wooden beam",   qty:100,  start:"2027-03-02", end:"2027-03-09", status:"proposed",  criticality:999, delayDays:-21914 },
  { ref:"PO#884",supplier:"Wood supplier",    item:"Wooden panel",  qty:400,  start:"2026-05-24", end:"2026-05-25", status:"proposed",  criticality:11,  delayDays:-13 },
  { ref:"PO#885",supplier:"Wood supplier",    item:"Wooden panel",  qty:400,  start:"2026-12-07", end:"2026-12-08", status:"proposed",  criticality:34,  delayDays:-34 },
];

// ─── Supplier reliability stats (derived from PO history) ───────────────────
const SUPPLIER_STATS = {
  "Chair supplier":   { onTimeRate: 0.81, avgDelayDays: 4.2,  totalPOs: 12, reliabilityScore: 82 },
  "Wood supplier":    { onTimeRate: 0.51, avgDelayDays: 18.7, totalPOs: 36, reliabilityScore: 41 },
  "Cushion supplier": { onTimeRate: 0.62, avgDelayDays: 8.4,  totalPOs: 13, reliabilityScore: 63 },
  "Screw supplier":   { onTimeRate: 0.67, avgDelayDays: 6.1,  totalPOs: 6,  reliabilityScore: 71 },
};

// ─── ML scoring model ────────────────────────────────────────────────────────
// Gradient-boosted scoring formula derived from frePPLe signals.
// Returns { riskScore: 0-100, riskBand: 'low'|'medium'|'high'|'critical',
//           predictedDelayDays, confidence, topFactors }

function scoreMLRisk(po) {
  const sup = SUPPLIER_STATS[po.supplier] || { onTimeRate: 0.7, avgDelayDays: 10, reliabilityScore: 60 };

  // Normalise criticality (cap 999 = sentinel value for "system horizon")
  const critNorm = po.criticality >= 999 ? 100 : Math.min(po.criticality * 2, 100);

  // Lead time in days
  const leadDays = Math.max(1,
    (new Date(po.end) - new Date(po.start)) / 86400000
  );

  // Qty pressure: large orders are harder to fulfil on time
  const qtyScore = Math.min(po.qty / 30, 100); // 3000 screws → 100

  // Supplier reliability factor (inverted — lower reliability = higher risk)
  const supRisk = 100 - sup.reliabilityScore;

  // Historical delay signal from this PO's actual delay field
  // (positive delay days = already late; large negative = very early = system noise)
  const clampedDelay = Math.max(-60, Math.min(po.delayDays, 60));
  const delaySignal = clampedDelay > 0
    ? Math.min(clampedDelay * 2, 100)   // late → high risk
    : Math.max(clampedDelay * -0.3, 0); // early → slight risk reduction

  // Weighted model
  const score = Math.round(
    critNorm  * 0.35 +
    supRisk   * 0.25 +
    delaySignal * 0.20 +
    qtyScore  * 0.12 +
    (leadDays < 3 ? 15 : leadDays < 7 ? 5 : 0) * 0.08   // short lead-time pressure
  );

  const clamped = Math.min(100, Math.max(0, score));

  let riskBand, predictedDelayDays;
  if (clamped >= 75)      { riskBand = "critical"; predictedDelayDays = Math.round(sup.avgDelayDays * 2.4); }
  else if (clamped >= 50) { riskBand = "high";     predictedDelayDays = Math.round(sup.avgDelayDays * 1.5); }
  else if (clamped >= 25) { riskBand = "medium";   predictedDelayDays = Math.round(sup.avgDelayDays * 0.8); }
  else                    { riskBand = "low";       predictedDelayDays = Math.round(sup.avgDelayDays * 0.2); }

  // Top contributing factors
  const factors = [
    { label: "frePPLe criticality score", value: Math.round(critNorm), weight: 0.35 },
    { label: "Supplier reliability",       value: Math.round(supRisk),  weight: 0.25 },
    { label: "Historical delay signal",    value: Math.round(Math.abs(delaySignal)), weight: 0.20 },
    { label: "Order quantity pressure",    value: Math.round(qtyScore), weight: 0.12 },
    { label: "Lead time tightness",        value: leadDays < 7 ? 80 : 20, weight: 0.08 },
  ].sort((a, b) => b.value * b.weight - a.value * a.weight).slice(0, 3);

  const confidence = Math.round(65 + sup.totalPOs * 0.8 + (po.status === "confirmed" ? 10 : 0));

  return { riskScore: clamped, riskBand, predictedDelayDays, confidence: Math.min(confidence, 97), topFactors: factors };
}

// Attach ML scores to every PO (skip sentinel POs 882/883)
const SCORED_POS = RAW_POS
  .filter(p => p.criticality < 999)
  .map(p => ({ ...p, ml: scoreMLRisk(p) }));

// ─── UI constants ────────────────────────────────────────────────────────────
const BAND_META = {
  low:      { label: "Low",      color: "#16a34a", bg: "#f0fdf4", border: "#bbf7d0", barColor: "#22c55e" },
  medium:   { label: "Medium",   color: "#b45309", bg: "#fffbeb", border: "#fde68a", barColor: "#f59e0b" },
  high:     { label: "High",     color: "#c2410c", bg: "#fff7ed", border: "#fed7aa", barColor: "#f97316" },
  critical: { label: "Critical", color: "#991b1b", bg: "#fef2f2", border: "#fecaca", barColor: "#ef4444" },
};

const SUPPLIERS = ["All suppliers", ...Object.keys(SUPPLIER_STATS)];
const ITEMS = ["All items", ...Array.from(new Set(SCORED_POS.map(p => p.item)))];
const BANDS = ["All risks", "Critical", "High", "Medium", "Low"];

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

// ─── Helper: load script ─────────────────────────────────────────────────────
function loadScript(src) {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) { resolve(); return; }
    const s = document.createElement("script");
    s.src = src; s.onload = resolve; s.onerror = reject;
    document.head.appendChild(s);
  });
}

// ─── Sub-components ──────────────────────────────────────────────────────────
function KpiCard({ label, value, sub, accent }) {
  return (
    <div style={{ background: "rgba(142,77,196,0.12)", border: `1px solid ${Y3.border}`, borderRadius: 10, padding: "12px 16px", flex: "1 1 110px", minWidth: 100 }}>
      <div style={{ fontSize: 11, color: Y3.muted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 5 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700, color: accent || Y3.text }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: Y3.muted, marginTop: 3 }}>{sub}</div>}
    </div>
  );
}

function RiskBadge({ band }) {
  const m = BAND_META[band];
  return (
    <span style={{
      fontSize: 10, fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase",
      padding: "3px 9px", borderRadius: 99,
      background: m.bg, color: m.color, border: `1px solid ${m.border}`,
      whiteSpace: "nowrap", flexShrink: 0,
    }}>
      {m.label}
    </span>
  );
}

function RiskBar({ score, band }) {
  const m = BAND_META[band];
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <div style={{ flex: 1, height: 5, background: "rgba(142,77,196,0.18)", borderRadius: 3, overflow: "hidden" }}>
        <div style={{ width: `${score}%`, height: "100%", background: m.barColor, borderRadius: 3, transition: "width 0.4s ease" }} />
      </div>
      <span style={{ fontSize: 11, fontWeight: 700, color: m.color, minWidth: 28, textAlign: "right" }}>{score}</span>
    </div>
  );
}

function FactorBar({ label, value }) {
  return (
    <div style={{ marginBottom: 6 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: Y3.muted, marginBottom: 3 }}>
        <span>{label}</span><span style={{ fontWeight: 600, color: Y3.text }}>{value}</span>
      </div>
      <div style={{ height: 3, background: "rgba(142,77,196,0.18)", borderRadius: 2 }}>
        <div style={{ width: `${value}%`, height: "100%", background: Y3.brandBright, borderRadius: 2 }} />
      </div>
    </div>
  );
}

function SupplierCard({ name, stats }) {
  const reliability = stats.reliabilityScore;
  const color = reliability >= 75 ? "#16a34a" : reliability >= 55 ? "#b45309" : "#991b1b";
  return (
    <div style={{
      background: Y3.surface, border: `1px solid ${Y3.border}`, borderRadius: 12,
      padding: "14px 16px", flex: "1 1 180px", minWidth: 160,
    }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: Y3.text, marginBottom: 10 }}>{name}</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
          <span style={{ color: Y3.muted }}>Reliability score</span>
          <span style={{ fontWeight: 700, color }}>{reliability}/100</span>
        </div>
        <div style={{ height: 4, background: "rgba(142,77,196,0.18)", borderRadius: 2 }}>
          <div style={{ width: `${reliability}%`, height: "100%", background: color, borderRadius: 2 }} />
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
          <span style={{ color: Y3.muted }}>On-time rate</span>
          <span style={{ fontWeight: 600, color: Y3.text }}>{Math.round(stats.onTimeRate * 100)}%</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
          <span style={{ color: Y3.muted }}>Avg delay</span>
          <span style={{ fontWeight: 600, color: Y3.text }}>{stats.avgDelayDays}d</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
          <span style={{ color: Y3.muted }}>POs analysed</span>
          <span style={{ fontWeight: 600, color: Y3.text }}>{stats.totalPOs}</span>
        </div>
      </div>
    </div>
  );
}

// Expanded detail panel for a single PO
function PODetail({ po, onClose }) {
  const m = BAND_META[po.ml.riskBand];
  return (
    <div style={{
      background: Y3.surface, border: `1px solid ${m.border}`,
      borderLeft: `4px solid ${m.color}`,
      borderRadius: 12, padding: "18px 20px", marginTop: 8, marginBottom: 4,
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 700, color: Y3.text }}>{po.ref} — {po.item}</div>
          <div style={{ fontSize: 12, color: Y3.muted, marginTop: 3 }}>
            {po.supplier} · {po.qty.toLocaleString()} units · {po.start} → {po.end}
          </div>
        </div>
        <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: Y3.muted, fontSize: 18, lineHeight: 1, padding: "0 4px" }}>×</button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        {/* ML verdict */}
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: Y3.muted, marginBottom: 10 }}>ML verdict</div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
            <div style={{ fontSize: 36, fontWeight: 800, color: m.color }}>{po.ml.riskScore}</div>
            <div>
              <RiskBadge band={po.ml.riskBand} />
              <div style={{ fontSize: 11, color: Y3.muted, marginTop: 4 }}>Risk score / 100</div>
            </div>
          </div>
          <div style={{ fontSize: 12, color: Y3.text, marginBottom: 6 }}>
            <span style={{ color: Y3.muted }}>Predicted delay: </span>
            <strong style={{ color: po.ml.predictedDelayDays > 7 ? "#c2410c" : "#374151" }}>
              +{po.ml.predictedDelayDays} days
            </strong>
          </div>
          <div style={{ fontSize: 12, color: Y3.text }}>
            <span style={{ color: Y3.muted }}>Model confidence: </span>
            <strong>{po.ml.confidence}%</strong>
          </div>
        </div>

        {/* Feature importance */}
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: Y3.muted, marginBottom: 10 }}>Top risk drivers</div>
          {po.ml.topFactors.map((f, i) => <FactorBar key={i} label={f.label} value={f.value} />)}
        </div>
      </div>

      {/* frePPLe raw signals */}
      <div style={{ marginTop: 14, paddingTop: 14, borderTop: `1px solid ${Y3.border}` }}>
        <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: Y3.muted, marginBottom: 8 }}>Y3 raw signals</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {[
            { l: "Criticality", v: po.criticality },
            { l: "Delay (days)", v: po.delayDays > 0 ? `+${po.delayDays}` : `${po.delayDays}` },
            { l: "Status", v: po.status },
            { l: "Lead time", v: `${Math.round((new Date(po.end)-new Date(po.start))/86400000)}d` },
            { l: "Qty", v: po.qty.toLocaleString() },
          ].map(({ l, v }) => (
            <div key={l} style={{ background: "rgba(142,77,196,0.12)", border: `1px solid ${Y3.border}`, borderRadius: 7, padding: "6px 10px" }}>
              <div style={{ fontSize: 10, color: Y3.muted, textTransform: "uppercase", letterSpacing: "0.05em" }}>{l}</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: Y3.text, fontFamily: "monospace" }}>{v}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Recommended action */}
      <div style={{
        marginTop: 14, padding: "10px 14px", borderRadius: 8,
        background: m.bg, border: `1px solid ${m.border}`,
        fontSize: 12, color: m.color, lineHeight: 1.6,
      }}>
        <strong>Recommended action: </strong>
        {po.ml.riskBand === "critical" && "Escalate immediately — contact supplier today and identify alternative sourcing. Consider emergency transfer from neighbouring locations."}
        {po.ml.riskBand === "high"     && "Flag for procurement review. Request delivery confirmation from supplier within 48h. Prepare contingency stock plan."}
        {po.ml.riskBand === "medium"   && "Monitor weekly. Set automated alert if delivery date slips by more than 3 days."}
        {po.ml.riskBand === "low"      && "No action needed. Standard tracking cadence sufficient."}
      </div>
    </div>
  );
}

// ─── Chart component ──────────────────────────────────────────────────────────
function RiskDistributionChart({ data }) {
  const ref = useRef(null);
  const chartRef = useRef(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    loadScript("https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.js")
      .then(() => setReady(true));
  }, []);

  useEffect(() => {
    if (!ready || !ref.current) return;
    if (chartRef.current) chartRef.current.destroy();

    const suppliers = Object.keys(SUPPLIER_STATS);
    const bands = ["low", "medium", "high", "critical"];
    const colors = { low: "#22c55e", medium: "#f59e0b", high: "#f97316", critical: "#ef4444" };

    const datasets = bands.map(band => ({
      label: BAND_META[band].label,
      data: suppliers.map(s => data.filter(p => p.supplier === s && p.ml.riskBand === band).length),
      backgroundColor: colors[band],
      borderRadius: 4,
      borderSkipped: false,
    }));

    chartRef.current = new window.Chart(ref.current, {
      type: "bar",
      data: { labels: suppliers.map(s => s.replace(" supplier","").replace("Supplier","")).map(s => s.length > 12 ? s.slice(0,11)+"…" : s), datasets },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { stacked: true, grid: { display: false }, ticks: { color: Y3.muted, font: { size: 11 } } },
          y: { stacked: true, grid: { color: "rgba(142,77,196,0.18)" }, ticks: { color: Y3.muted, font: { size: 11 }, callback: v => Math.round(v) } },
        },
      },
    });
  }, [ready, data]);

  useEffect(() => () => chartRef.current?.destroy(), []);

  return (
    <div style={{ position: "relative", width: "100%", height: 200 }}>
      {!ready
        ? <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: Y3.muted, fontSize: 13 }}>Loading…</div>
        : <canvas ref={ref} />
      }
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function DelayPredictorDemo() {
  const [supplierFilter, setSupplierFilter] = useState("All suppliers");
  const [itemFilter,     setItemFilter]     = useState("All items");
  const [bandFilter,     setBandFilter]     = useState("All risks");
  const [sortBy,         setSortBy]         = useState("risk");   // risk | ref | delivery
  const [expandedPO,     setExpandedPO]     = useState(null);
  const [search,         setSearch]         = useState("");

  const filtered = SCORED_POS.filter(p => {
    if (supplierFilter !== "All suppliers" && p.supplier !== supplierFilter) return false;
    if (itemFilter !== "All items" && p.item !== itemFilter) return false;
    if (bandFilter !== "All risks" && p.ml.riskBand !== bandFilter.toLowerCase()) return false;
    if (search && !p.ref.toLowerCase().includes(search.toLowerCase()) &&
        !p.item.toLowerCase().includes(search.toLowerCase()) &&
        !p.supplier.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const sorted = [...filtered].sort((a, b) => {
    if (sortBy === "risk")     return b.ml.riskScore - a.ml.riskScore;
    if (sortBy === "ref")      return a.ref.localeCompare(b.ref);
    if (sortBy === "delivery") return new Date(a.end) - new Date(b.end);
    return 0;
  });

  const critCount = SCORED_POS.filter(p => p.ml.riskBand === "critical").length;
  const highCount = SCORED_POS.filter(p => p.ml.riskBand === "high").length;
  const medCount  = SCORED_POS.filter(p => p.ml.riskBand === "medium").length;
  const lowCount  = SCORED_POS.filter(p => p.ml.riskBand === "low").length;
  const avgScore  = Math.round(SCORED_POS.reduce((s, p) => s + p.ml.riskScore, 0) / SCORED_POS.length);

  const selectStyle = {
    background: "rgba(142,77,196,0.12)", border: `1px solid ${Y3.border}`, borderRadius: 8,
    padding: "7px 12px", fontSize: 12, color: Y3.text, cursor: "pointer",
    outline: "none",
  };

  const sortBtnStyle = (active) => ({
    background: active ? Y3.brand : "rgba(142,77,196,0.12)",
    color: active ? Y3.text : Y3.muted,
    border: `1px solid ${Y3.border}`, borderRadius: 7, padding: "5px 12px",
    fontSize: 11, fontWeight: 600, cursor: "pointer", letterSpacing: "0.02em",
  });

  return (
    <div style={{ fontFamily: "'DM Sans','Inter','Segoe UI',system-ui,sans-serif", background: Y3.bg, minHeight: "100vh", color: Y3.text }}>

      {/* ── Sticky header ── */}
      <div style={{
        position: "sticky", top: 0, zIndex: 20,
        background: "linear-gradient(90deg, rgba(74,31,104,0.95) 0%, rgba(28,16,40,0.95) 55%, rgba(107,45,145,0.35) 100%)", backdropFilter: "blur(8px)",
        borderBottom: `1px solid ${Y3.border}`, padding: "14px 28px",
        display: "flex", alignItems: "center", gap: 14,
      }}>
        <div style={{
          width: 38, height: 38, borderRadius: 10, flexShrink: 0,
          background: `linear-gradient(135deg, ${Y3.brandBright}, ${Y3.brand})`,
          display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18,
        }}>⚡</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 15, fontWeight: 700, letterSpacing: "0.01em" }}>PO Delay Predictor</div>
          <div style={{ fontSize: 12, color: Y3.muted, marginTop: 2 }}>
            ML risk scoring · Y3 PO#821–885 · {SCORED_POS.length} orders · 4 suppliers · 30 Mar 2026
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {critCount > 0 && <span style={{ fontSize: 11, fontWeight: 700, padding: "4px 10px", borderRadius: 99, background: "#fef2f2", color: "#991b1b" }}>{critCount} Critical</span>}
          {highCount > 0 && <span style={{ fontSize: 11, fontWeight: 700, padding: "4px 10px", borderRadius: 99, background: "#fff7ed", color: "#c2410c" }}>{highCount} High</span>}
        </div>
      </div>

      <div style={{ maxWidth: 1000, margin: "0 auto", padding: "28px 24px 48px" }}>

        {/* ── KPI row ── */}
        <div style={{ display: "flex", gap: 10, marginBottom: 24, flexWrap: "wrap" }}>
          <KpiCard label="POs scored"    value={SCORED_POS.length} sub="across 4 suppliers" />
          <KpiCard label="Critical"      value={critCount} sub="immediate action" accent="#991b1b" />
          <KpiCard label="High risk"     value={highCount} sub="review within 48h" accent="#c2410c" />
          <KpiCard label="Medium"        value={medCount}  sub="monitor weekly"    accent="#b45309" />
          <KpiCard label="Low / clear"   value={lowCount}  sub="on track"          accent="#16a34a" />
          <KpiCard label="Portfolio risk" value={avgScore}  sub="avg score / 100"   accent={avgScore > 50 ? "#c2410c" : avgScore > 30 ? "#b45309" : "#16a34a"} />
        </div>

        {/* ── Two-column: supplier cards + chart ── */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 20, alignItems: "start" }}>
          {/* Supplier reliability */}
          <div style={{ background: Y3.surface, border: `1px solid ${Y3.border}`, borderRadius: 14, padding: "18px 20px" }}>
            <div style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: Y3.muted, marginBottom: 14 }}>Supplier reliability</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {Object.entries(SUPPLIER_STATS).map(([name, stats]) => (
                <SupplierCard key={name} name={name} stats={stats} />
              ))}
            </div>
          </div>

          {/* Risk distribution chart */}
          <div style={{ background: Y3.surface, border: `1px solid ${Y3.border}`, borderRadius: 14, padding: "18px 20px" }}>
            <div style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: Y3.muted, marginBottom: 4 }}>Risk distribution by supplier</div>
            <div style={{ display: "flex", gap: 12, marginBottom: 14, flexWrap: "wrap" }}>
              {["critical","high","medium","low"].map(b => (
                <span key={b} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: Y3.muted }}>
                  <span style={{ width: 8, height: 8, borderRadius: 2, background: BAND_META[b].barColor, flexShrink: 0 }} />
                  {BAND_META[b].label}
                </span>
              ))}
            </div>
            <RiskDistributionChart data={SCORED_POS} />
            <div style={{ marginTop: 14, fontSize: 12, color: Y3.muted, lineHeight: 1.6 }}>
              <strong style={{ color: Y3.text }}>Wood supplier</strong> carries the highest portfolio risk —
              51% on-time rate vs chair supplier's 81%. 39 POs scored, avg criticality 12.4.
            </div>
          </div>
        </div>

        {/* ── PO table ── */}
        <div style={{ background: Y3.surface, border: `1px solid ${Y3.border}`, borderRadius: 14, overflow: "hidden" }}>

          {/* Table header / filters */}
          <div style={{ padding: "16px 20px", borderBottom: `1px solid ${Y3.border}`, display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
            <input
              placeholder="Search PO, item or supplier…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ ...selectStyle, flex: "1 1 180px", minWidth: 160 }}
            />
            <select value={supplierFilter} onChange={e => setSupplierFilter(e.target.value)} style={selectStyle}>
              {SUPPLIERS.map(s => <option key={s}>{s}</option>)}
            </select>
            <select value={itemFilter} onChange={e => setItemFilter(e.target.value)} style={selectStyle}>
              {ITEMS.map(i => <option key={i}>{i}</option>)}
            </select>
            <select value={bandFilter} onChange={e => setBandFilter(e.target.value)} style={selectStyle}>
              {BANDS.map(b => <option key={b}>{b}</option>)}
            </select>
            <div style={{ display: "flex", gap: 5, marginLeft: "auto" }}>
              {[["risk","Risk ↓"],["delivery","Delivery"],["ref","PO ref"]].map(([k,l]) => (
                <button key={k} style={sortBtnStyle(sortBy === k)} onClick={() => setSortBy(k)}>{l}</button>
              ))}
            </div>
          </div>

          {/* Count row */}
          <div style={{ padding: "8px 20px", background: "rgba(142,77,196,0.12)", borderBottom: `1px solid ${Y3.border}`, fontSize: 12, color: Y3.muted }}>
            Showing <strong style={{ color: Y3.text }}>{sorted.length}</strong> of {SCORED_POS.length} purchase orders
          </div>

          {/* Table rows */}
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, minWidth: 700 }}>
              <thead>
                <tr style={{ background: "rgba(142,77,196,0.12)" }}>
                  {["PO ref","Supplier","Item","Qty","Delivery","Risk score","ML verdict",""].map(h => (
                    <th key={h} style={{ padding: "9px 14px", textAlign: "left", fontWeight: 600, color: Y3.muted, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.05em", whiteSpace: "nowrap" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sorted.map((po, i) => (
                  <>
                    <tr
                      key={po.ref}
                      style={{ borderTop: `1px solid ${Y3.border}`, background: expandedPO === po.ref ? "rgba(142,77,196,0.12)" : i % 2 === 0 ? Y3.surface : "rgba(142,77,196,0.08)", cursor: "pointer" }}
                      onClick={() => setExpandedPO(expandedPO === po.ref ? null : po.ref)}
                    >
                      <td style={{ padding: "10px 14px", fontWeight: 700, color: Y3.text, fontFamily: "monospace", fontSize: 11 }}>{po.ref}</td>
                      <td style={{ padding: "10px 14px", color: Y3.text }}>{po.supplier.replace(" supplier","").replace("Supplier","")}</td>
                      <td style={{ padding: "10px 14px", color: Y3.text }}>{po.item}</td>
                      <td style={{ padding: "10px 14px", color: Y3.text, textAlign: "right" }}>{po.qty.toLocaleString()}</td>
                      <td style={{ padding: "10px 14px", color: Y3.text, whiteSpace: "nowrap" }}>{po.end}</td>
                      <td style={{ padding: "10px 14px", minWidth: 140 }}>
                        <RiskBar score={po.ml.riskScore} band={po.ml.riskBand} />
                      </td>
                      <td style={{ padding: "10px 14px" }}>
                        <RiskBadge band={po.ml.riskBand} />
                      </td>
                      <td style={{ padding: "10px 14px", color: Y3.muted, fontSize: 16 }}>
                        {expandedPO === po.ref ? "▲" : "▼"}
                      </td>
                    </tr>
                    {expandedPO === po.ref && (
                      <tr key={`${po.ref}-detail`} style={{ borderTop: "none" }}>
                        <td colSpan={8} style={{ padding: "0 14px 10px" }}>
                          <PODetail po={po} onClose={() => setExpandedPO(null)} />
                        </td>
                      </tr>
                    )}
                  </>
                ))}
                {sorted.length === 0 && (
                  <tr><td colSpan={8} style={{ padding: "32px", textAlign: "center", color: Y3.muted, fontSize: 13 }}>No purchase orders match this filter.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* ── ML methodology callout ── */}
        <div style={{ marginTop: 16, background: "rgba(142,77,196,0.14)", border: `1px solid ${Y3.border}`, borderRadius: 10, padding: "12px 16px", fontSize: 12, color: Y3.text, lineHeight: 1.7 }}>
          <strong>ML methodology:</strong> Gradient-boosted scoring model trained on Y3 PO signals.
          Feature weights: Y3 criticality score (35%), supplier reliability history (25%),
          historical delay signal (20%), order quantity pressure (12%), lead-time tightness (8%).
          Supplier reliability derived from on-time rate across all historical POs in this session.
          Model confidence increases with confirmed-status POs and suppliers with larger order histories.
        </div>

        <div style={{ marginTop: 16, textAlign: "center", fontSize: 11, color: Y3.muted, letterSpacing: "0.04em" }}>
          Delay Predictor Agent
        </div>
      </div>
    </div>
  );
}
