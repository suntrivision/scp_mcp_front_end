import { useState, useEffect, useRef } from "react";

// ─── Static frePPLe data (replace with API calls to make dynamic) ─────────────
const FORECAST_DATA = [
  { name: "chair @ shop 1", item: "chair", location: "shop 1", smape: 5.86, method: "trend", deviation: 17.26 },
  { name: "chair @ shop 2", item: "chair", location: "shop 2", smape: 22.48, method: "constant", deviation: 34.77 },
  { name: "chair @ warehouse", item: "chair", location: "warehouse", smape: 94.38, method: "intermittent", deviation: 11.03 },
  { name: "round table @ shop 1", item: "round table", location: "shop 1", smape: 33.87, method: "constant", deviation: 9.26 },
  { name: "round table @ shop 2", item: "round table", location: "shop 2", smape: 25.47, method: "constant", deviation: 8.09 },
  { name: "round table @ warehouse", item: "round table", location: "warehouse", smape: 89.28, method: "intermittent", deviation: 2.90 },
  { name: "square table @ shop 1", item: "square table", location: "shop 1", smape: 20.74, method: "constant", deviation: 7.37 },
  { name: "square table @ shop 2", item: "square table", location: "shop 2", smape: 32.09, method: "constant", deviation: 8.83 },
  { name: "square table @ warehouse", item: "square table", location: "warehouse", smape: 100.0, method: "intermittent", deviation: 1.0 },
  { name: "varnished chair @ shop 1", item: "varnished chair", location: "shop 1", smape: 5.86, method: "trend", deviation: 8.63 },
  { name: "varnished chair @ shop 2", item: "varnished chair", location: "shop 2", smape: 22.48, method: "constant", deviation: 17.39 },
  { name: "varnished chair @ warehouse", item: "varnished chair", location: "warehouse", smape: 94.38, method: "intermittent", deviation: 5.51 },
];

const CLOSED_ORDERS = [
  { item: "chair", location: "shop 1", qty: 1154, months: 6 },
  { item: "chair", location: "shop 2", qty: 546, months: 6 },
  { item: "chair", location: "warehouse", qty: 70, months: 6 },
  { item: "round table", location: "shop 1", qty: 84, months: 6 },
  { item: "round table", location: "shop 2", qty: 42, months: 6 },
  { item: "square table", location: "shop 1", qty: 115, months: 6 },
  { item: "square table", location: "shop 2", qty: 91, months: 6 },
  { item: "varnished chair", location: "shop 1", qty: 552, months: 6 },
  { item: "varnished chair", location: "shop 2", qty: 162, months: 6 },
];

const SHORTAGE_REPORT = [
  { name: "Demand 01", item: "round table", location: "shop 2", due: "2026-04-01", qty: 20, delayDays: 31 },
  { name: "Demand 07", item: "chair", location: "shop 1", due: "2026-03-31", qty: 40, delayDays: 22 },
  { name: "Demand 08", item: "square table", location: "shop 1", due: "2026-03-31", qty: 30, delayDays: 30 },
  { name: "Demand 09", item: "round table", location: "shop 1", due: "2026-03-31", qty: 20, delayDays: 3 },
  { name: "Demand 10", item: "chair", location: "shop 2", due: "2026-03-31", qty: 10, delayDays: 21 },
  { name: "Demand 11", item: "chair", location: "shop 2", due: "2026-03-31", qty: 10, delayDays: 21 },
  { name: "Demand 12", item: "varnished chair", location: "shop 2", due: "2026-03-31", qty: 5, delayDays: 35 },
  { name: "Demand 14", item: "varnished chair", location: "shop 1", due: "2026-03-31", qty: 20, delayDays: 36 },
];

const PURCHASE_ORDERS = [
  { ref: "PO#852", item: "wooden beam", supplier: "wood supplier", qty: 700, startdate: "2026-03-30", status: "proposed", risk: "high", note: "Pegged to over-forecast chair" },
  { ref: "PO#853", item: "wooden beam", supplier: "wood supplier", qty: 350, startdate: "2026-04-13", status: "proposed", risk: "medium", note: "Partly pegged to round table" },
  { ref: "PO#846", item: "screws", supplier: "screw supplier", qty: 3000, startdate: "2026-04-19", status: "proposed", risk: "medium", note: "Square table demand overstated" },
  { ref: "PO#884", item: "wooden panel", supplier: "wood supplier", qty: 400, startdate: "2026-05-24", status: "proposed", risk: "medium", note: "Round/square table dependency" },
  { ref: "PO#821", item: "chair (raw)", supplier: "chair supplier", qty: 750, startdate: "2026-03-30", status: "proposed", risk: "low", note: "Warehouse forecast risk" },
];

const EXCEPTIONS = [
  { item: "round table @ shop 1", smape: 33.87, periods: 2, detail: "Constant method; over-forecast vs 84 units actual closed orders." },
  { item: "square table @ shop 2", smape: 32.09, periods: 2, detail: "High deviation; forecast above actual sales of 91 units in 6 months." },
  { item: "round table @ shop 2", smape: 25.47, periods: 2, detail: "Borderline threshold; two consecutive periods of over-forecast." },
];

const INVENTORY_RISKS = [
  { item: "chair @ warehouse", smape: 94.38, msg: "Intermittent demand — forecast grossly overstates actuals (70 units sold). Recommend safety stock only." },
  { item: "square table @ warehouse", smape: 100.0, msg: "100% SMAPE — model unable to predict demand. No recent closed orders. Flag for manual review." },
];

// Y3 brand (matches App.css / y3-logo — deep violet surfaces)
const T = {
  text: "var(--text)",
  muted: "var(--muted)",
  surface: "var(--surface)",
  surfaceLift: "rgba(142, 77, 196, 0.12)",
  border: "var(--border)",
  brand: "var(--brand)",
  brandBright: "var(--brand-bright)",
  track: "rgba(255, 255, 255, 0.08)",
  bg: "var(--bg)",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
const smapeColor = (v) => v > 50 ? "#f87171" : v > 25 ? "#fbbf24" : "#34d399";
const smapeBg = (v) => v > 50 ? "rgba(248, 113, 113, 0.14)" : v > 25 ? "rgba(245, 158, 11, 0.14)" : "rgba(52, 211, 153, 0.14)";
const smapeText = (v) => v > 50 ? "#fca5a5" : v > 25 ? "#fcd34d" : "#6ee7b7";
const riskColor = (r) => r === "high" ? "#ef4444" : r === "medium" ? "#f59e0b" : "var(--brand-bright)";
const riskBg = (r) => r === "high" ? "rgba(248, 113, 113, 0.14)" : r === "medium" ? "rgba(245, 158, 11, 0.14)" : "rgba(142, 77, 196, 0.2)";
const riskText = (r) => r === "high" ? "#fca5a5" : r === "medium" ? "#fcd34d" : "#e9d5ff";

// ─── Sub-components ───────────────────────────────────────────────────────────

function PulsingDot({ color = "var(--brand-bright)" }) {
  return (
    <span style={{ position: "relative", display: "inline-block", width: 10, height: 10 }}>
      <span style={{
        position: "absolute", inset: 0, borderRadius: "50%", background: color,
        animation: "ping 1.5s cubic-bezier(0,0,.2,1) infinite", opacity: 0.5
      }} />
      <span style={{ position: "absolute", inset: 0, borderRadius: "50%", background: color }} />
    </span>
  );
}

function Badge({ label, color = "var(--brand-bright)", bg = "rgba(142, 77, 196, 0.2)" }) {
  return (
    <span style={{
      display: "inline-block", padding: "2px 9px", borderRadius: 20,
      fontSize: 11, fontWeight: 600, letterSpacing: "0.02em",
      color, background: bg, fontFamily: "var(--font-mono, monospace)"
    }}>{label}</span>
  );
}

function MetricCard({ label, value, sub, accent }) {
  return (
    <div style={{
      background: T.surfaceLift, border: `1px solid ${T.border}`, borderRadius: 14,
      padding: "18px 20px", flex: 1, minWidth: 0,
      borderTop: `3px solid ${accent}`
    }}>
      <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.08em", color: T.muted, textTransform: "uppercase", marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 700, color: T.text, lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: T.muted, marginTop: 6 }}>{sub}</div>}
    </div>
  );
}

function SmapeBar({ row }) {
  const [width, setWidth] = useState(0);
  useEffect(() => { setTimeout(() => setWidth(Math.min(row.smape, 100)), 100); }, [row.smape]);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 0", borderBottom: `1px solid ${T.border}` }}>
      <div style={{ width: 190, fontSize: 12, color: T.muted, fontFamily: "var(--font-mono,monospace)", flexShrink: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
        {row.name}
      </div>
      <div style={{ flex: 1, height: 7, background: T.track, borderRadius: 4, overflow: "hidden" }}>
        <div style={{
          height: "100%", width: `${width}%`,
          background: smapeColor(row.smape),
          borderRadius: 4, transition: "width 0.8s cubic-bezier(.4,0,.2,1)"
        }} />
      </div>
      <div style={{ width: 64, textAlign: "right", fontSize: 12, fontWeight: 700, color: smapeColor(row.smape), fontFamily: "monospace" }}>
        {row.smape.toFixed(1)}%
      </div>
      <Badge label={row.method} color="var(--brand-bright)" bg="rgba(142, 77, 196, 0.22)" />
    </div>
  );
}

// ─── Tab panels ───────────────────────────────────────────────────────────────

function ReportTab() {
  const avgSmape = (FORECAST_DATA.reduce((a, b) => a + b.smape, 0) / FORECAST_DATA.length).toFixed(1);
  return (
    <div>
      <div style={{ display: "flex", gap: 14, marginBottom: 28, flexWrap: "wrap" }}>
        <MetricCard label="Products Monitored" value={FORECAST_DATA.length} sub="All SKUs active" accent="var(--brand-bright)" />
        <MetricCard label="Avg SMAPE" value={`${avgSmape}%`} sub="High volatility detected" accent="var(--danger)" />
        <MetricCard label="Exceptions Triggered" value={EXCEPTIONS.length} sub="MAPE > 25% rule" accent="var(--warn)" />
        <MetricCard label="Inventory Risk Flags" value={INVENTORY_RISKS.length} sub="Forecast > Actuals" accent="var(--danger)" />
      </div>

      <Section title="SMAPE by Product & Location">
        <div style={{ padding: "4px 0" }}>
          {FORECAST_DATA.map(row => <SmapeBar key={row.name} row={row} />)}
        </div>
      </Section>

      <Section title="Forecast Bias — Closed Orders vs Model">
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: `2px solid ${T.border}` }}>
                {["Product", "Location", "Closed Orders (6mo)", "Method", "Bias Signal", "Status"].map(h => (
                  <th key={h} style={{ textAlign: "left", padding: "8px 12px", fontSize: 11, fontWeight: 700, color: T.muted, letterSpacing: "0.06em", textTransform: "uppercase" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {CLOSED_ORDERS.map((r, i) => {
                const isRisk = r.location === "warehouse" || r.qty < 100;
                return (
                  <tr key={i} style={{ borderBottom: `1px solid ${T.border}` }}>
                    <td style={{ padding: "10px 12px", fontWeight: 500, color: T.text }}>{r.item}</td>
                    <td style={{ padding: "10px 12px", color: T.muted }}>{r.location}</td>
                    <td style={{ padding: "10px 12px", fontFamily: "monospace", color: T.text }}>{r.qty.toLocaleString()}</td>
                    <td style={{ padding: "10px 12px" }}>
                      <Badge label={FORECAST_DATA.find(f => f.item === r.item && f.location === r.location)?.method || "—"} color="var(--brand-bright)" bg="rgba(142, 77, 196, 0.2)" />
                    </td>
                    <td style={{ padding: "10px 12px", color: isRisk ? "var(--danger)" : "var(--ok)", fontSize: 12 }}>
                      {isRisk ? "⚠ Inventory Risk" : "✓ Aligned"}
                    </td>
                    <td style={{ padding: "10px 12px" }}>
                      <Badge label={isRisk ? "Investigate" : "OK"} color={isRisk ? "#fca5a5" : "#6ee7b7"} bg={isRisk ? "rgba(248, 113, 113, 0.14)" : "rgba(52, 211, 153, 0.14)"} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Section>
    </div>
  );
}

function ExceptionsTab() {
  return (
    <div>
      <Section title="Active Exceptions — MAPE > 25% Trigger">
        {EXCEPTIONS.map((e, i) => (
          <div key={i} style={{ display: "flex", gap: 14, padding: "14px 0", borderBottom: `1px solid ${T.border}`, alignItems: "flex-start" }}>
            <div style={{
              width: 36, height: 36, borderRadius: "50%", background: "rgba(248, 113, 113, 0.14)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 15, flexShrink: 0
            }}>⚠</div>
            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
                <span style={{ fontWeight: 600, fontSize: 14, color: T.text }}>{e.item}</span>
                <Badge label="Exception" color="#fca5a5" bg="rgba(248, 113, 113, 0.14)" />
              </div>
              <div style={{ fontSize: 12, color: T.muted, marginBottom: 3 }}>
                SMAPE: <span style={{ fontWeight: 700, color: "#f87171", fontFamily: "monospace" }}>{e.smape.toFixed(1)}%</span>
                &nbsp;·&nbsp;{e.periods} consecutive periods over threshold
              </div>
              <div style={{ fontSize: 12, color: T.muted }}>{e.detail}</div>
            </div>
          </div>
        ))}
      </Section>

      <Section title="Inventory Risk Alerts">
        {INVENTORY_RISKS.map((r, i) => (
          <div key={i} style={{ display: "flex", gap: 14, padding: "14px 0", borderBottom: `1px solid ${T.border}`, alignItems: "flex-start" }}>
            <div style={{
              width: 36, height: 36, borderRadius: "50%", background: "rgba(245, 158, 11, 0.14)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 15, flexShrink: 0
            }}>🔺</div>
            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
                <span style={{ fontWeight: 600, fontSize: 14, color: T.text }}>{r.item}</span>
                <Badge label="Inventory Risk" color="#fca5a5" bg="rgba(248, 113, 113, 0.14)" />
              </div>
              <div style={{ fontSize: 12, color: T.muted, marginBottom: 3 }}>
                SMAPE: <span style={{ fontWeight: 700, color: "#f87171", fontFamily: "monospace" }}>{r.smape.toFixed(1)}%</span>
              </div>
              <div style={{ fontSize: 12, color: T.muted }}>{r.msg}</div>
            </div>
          </div>
        ))}
      </Section>
    </div>
  );
}

function ScenarioTab() {
  const [applied, setApplied] = useState(false);
  return (
    <div>
      <div style={{
        background: "linear-gradient(135deg, rgba(107, 45, 145, 0.25) 0%, rgba(28, 16, 40, 0.95) 55%, rgba(74, 31, 104, 0.35) 100%)",
        border: `1px solid ${T.border}`, borderRadius: 14, padding: "20px 24px", marginBottom: 24
      }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", color: "var(--brand-bright)", textTransform: "uppercase", marginBottom: 6 }}>Auto-proposed scenario</div>
        <div style={{ fontSize: 18, fontWeight: 700, color: T.text, marginBottom: 10 }}>Forecast Downside — Raw Material PO Review</div>
        <div style={{ fontSize: 13, color: T.muted, lineHeight: 1.7 }}>
          Over-forecasting detected on <strong>round table</strong>, <strong>square table</strong>, and warehouse-location <strong>chair</strong>.
          The Sentinel proposes a <strong style={{ color: "var(--danger)" }}>−20% forecast adjustment</strong> on these items,
          triggering a review of all raw material POs pegged to these demand streams.
        </div>
      </div>

      <Section title="Proposed PO Cancellations / Deferrals">
        {PURCHASE_ORDERS.map((po, i) => (
          <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 0", borderBottom: `1px solid ${T.border}` }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
                <span style={{ fontFamily: "monospace", fontSize: 12, fontWeight: 700, color: "var(--brand-bright)" }}>{po.ref}</span>
                <span style={{ fontSize: 13, color: T.text, fontWeight: 500 }}>{po.item}</span>
              </div>
              <div style={{ fontSize: 12, color: T.muted }}>
                {po.qty.toLocaleString()} units · {po.supplier} · starts {po.startdate}
              </div>
              <div style={{ fontSize: 12, color: T.muted, marginTop: 2 }}>{po.note}</div>
            </div>
            <Badge label={po.risk === "high" ? "Cancel" : po.risk === "medium" ? "Defer" : "Monitor"}
              color={riskText(po.risk)} bg={riskBg(po.risk)} />
          </div>
        ))}
      </Section>

      <Section title="Scenario Impact Estimate">
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: `2px solid ${T.border}` }}>
                {["Metric", "Baseline", "Downside (−20%)", "Delta"].map(h => (
                  <th key={h} style={{ textAlign: "left", padding: "8px 12px", fontSize: 11, fontWeight: 700, color: T.muted, letterSpacing: "0.06em", textTransform: "uppercase" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[
                ["Total PO units at risk", "~2,700", "~2,160", { label: "−540 units", good: true }],
                ["Wooden beam POs (60d)", "4 orders", "2–3 orders", { label: "1–2 cancellable", good: true }],
                ["Screws POs (60d)", "6,000 units", "4,800 units", { label: "Defer 1,200", good: false }],
                ["Inventory risk items", "3 flagged", "1 flagged", { label: "Resolves 2", good: true }],
              ].map(([m, b, d, delta], i) => (
                <tr key={i} style={{ borderBottom: `1px solid ${T.border}` }}>
                  <td style={{ padding: "10px 12px", color: T.muted }}>{m}</td>
                  <td style={{ padding: "10px 12px", fontFamily: "monospace", color: T.text }}>{b}</td>
                  <td style={{ padding: "10px 12px", fontFamily: "monospace", color: T.text }}>{d}</td>
                  <td style={{ padding: "10px 12px" }}>
                    <Badge label={delta.label} color={delta.good ? "#6ee7b7" : "#fcd34d"} bg={delta.good ? "rgba(52, 211, 153, 0.14)" : "rgba(245, 158, 11, 0.14)"} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <div style={{ marginTop: 24 }}>
        {!applied ? (
          <button onClick={() => setApplied(true)} style={{
            display: "flex", alignItems: "center", gap: 8, padding: "12px 24px",
            background: "linear-gradient(135deg, var(--brand) 0%, var(--brand-dim) 100%)",
            color: "#f4eef9", border: `1px solid ${T.border}`, borderRadius: 10,
            fontSize: 14, fontWeight: 600, cursor: "pointer", transition: ".15s"
          }}>
            <span>Apply Forecast Downside Scenario</span>
            <span style={{ fontSize: 18 }}>→</span>
          </button>
        ) : (
          <div style={{ display: "flex", alignItems: "center", gap: 10, color: "var(--ok)", fontWeight: 600 }}>
            <span style={{ fontSize: 18 }}>✓</span>
            <span>Scenario applied — PO review list updated above</span>
          </div>
        )}
      </div>
    </div>
  );
}

function ShortageTab() {
  const fileRef = useRef();
  const [files, setFiles] = useState([]);
  const [dragging, setDragging] = useState(false);

  const handleFiles = (incoming) => {
    const newFiles = [...incoming].filter(f => !files.find(x => x.name === f.name));
    setFiles(prev => [...prev, ...newFiles]);
  };

  return (
    <div>
      {/* Drop zone */}
      <div
        onDragOver={e => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={e => { e.preventDefault(); setDragging(false); handleFiles(e.dataTransfer.files); }}
        onClick={() => fileRef.current?.click()}
        style={{
          border: `2px dashed ${dragging ? "var(--brand-bright)" : T.border}`,
          borderRadius: 14, padding: "32px 24px", textAlign: "center",
          cursor: "pointer", marginBottom: 20, transition: ".2s",
          background: dragging ? T.surfaceLift : "rgba(28, 16, 40, 0.5)"
        }}
      >
        <input ref={fileRef} type="file" multiple accept=".csv,.xlsx,.json" style={{ display: "none" }}
          onChange={e => handleFiles(e.target.files)} />
        <div style={{ fontSize: 32, marginBottom: 8 }}>📂</div>
        <div style={{ fontSize: 14, fontWeight: 600, color: T.text, marginBottom: 4 }}>
          Drop forecast, forecastplan or customer files here
        </div>
        <div style={{ fontSize: 12, color: T.muted }}>Accepts .csv, .xlsx, .json</div>
      </div>

      {files.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          {files.map(f => (
            <div key={f.name} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: `1px solid ${T.border}` }}>
              <span style={{ width: 18, height: 18, borderRadius: "50%", background: "rgba(52, 211, 153, 0.18)", color: "var(--ok)", fontSize: 11, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>✓</span>
              <span style={{ flex: 1, fontSize: 13, color: T.text }}>{f.name}</span>
              <span style={{ fontSize: 11, color: T.muted }}>{(f.size / 1024).toFixed(1)} KB</span>
              <button onClick={() => setFiles(prev => prev.filter(x => x.name !== f.name))}
                style={{ fontSize: 11, color: "#fca5a5", background: "rgba(248, 113, 113, 0.14)", border: `1px solid ${T.border}`, borderRadius: 6, padding: "2px 8px", cursor: "pointer" }}>
                Remove
              </button>
            </div>
          ))}
        </div>
      )}

      <Section title="Shortage Report — Open Demands with Delay">
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: `2px solid ${T.border}` }}>
                {["Demand", "Item", "Location", "Due Date", "Qty", "Delay", "Severity"].map(h => (
                  <th key={h} style={{ textAlign: "left", padding: "8px 12px", fontSize: 11, fontWeight: 700, color: T.muted, letterSpacing: "0.06em", textTransform: "uppercase" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {SHORTAGE_REPORT.sort((a, b) => b.delayDays - a.delayDays).map((r, i) => {
                const isCrit = r.delayDays > 20;
                return (
                  <tr key={i} style={{ borderBottom: `1px solid ${T.border}` }}>
                    <td style={{ padding: "10px 12px", fontFamily: "monospace", fontSize: 12, color: "var(--brand-bright)", fontWeight: 600 }}>{r.name}</td>
                    <td style={{ padding: "10px 12px", color: T.text }}>{r.item}</td>
                    <td style={{ padding: "10px 12px", color: T.muted }}>{r.location}</td>
                    <td style={{ padding: "10px 12px", color: T.muted, fontFamily: "monospace", fontSize: 12 }}>{r.due}</td>
                    <td style={{ padding: "10px 12px", fontFamily: "monospace", color: T.text }}>{r.qty}</td>
                    <td style={{ padding: "10px 12px" }}>
                      <Badge label={`${r.delayDays}d`} color={isCrit ? "#fca5a5" : "#fcd34d"} bg={isCrit ? "rgba(248, 113, 113, 0.14)" : "rgba(245, 158, 11, 0.14)"} />
                    </td>
                    <td style={{ padding: "10px 12px" }}>
                      <Badge label={isCrit ? "Critical" : "At Risk"} color={isCrit ? "#fca5a5" : "#fcd34d"} bg={isCrit ? "rgba(248, 113, 113, 0.14)" : "rgba(245, 158, 11, 0.14)"} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Section>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div style={{ marginBottom: 28 }}>
      <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.08em", color: T.muted, textTransform: "uppercase", marginBottom: 14 }}>{title}</div>
      <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 14, padding: "4px 16px" }}>
        {children}
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
const TABS = [
  { id: "report", label: "Bias & Volatility" },
  { id: "exceptions", label: "Exceptions", count: EXCEPTIONS.length },
  { id: "scenario", label: "Downside Scenario" },
  { id: "data", label: "Static Data / Shortages" },
];

export default function DemandSentinel() {
  const [activeTab, setActiveTab] = useState("report");
  const [tick, setTick] = useState(0);

  // Simulate a live refresh tick (hook into real API here later)
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 30000);
    return () => clearInterval(id);
  }, []);

  const now = new Date().toLocaleString("en-AU", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit"
  });

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;700&family=Sora:wght@400;500;600;700&display=swap');
        .demand-sentinel-root * { box-sizing: border-box; }
        .demand-sentinel-root { font-family: 'Sora', sans-serif; color: var(--text); }
        @keyframes ping {
          75%, 100% { transform: scale(2); opacity: 0; }
        }
        .demand-sentinel-root ::-webkit-scrollbar { width: 6px; height: 6px; }
        .demand-sentinel-root ::-webkit-scrollbar-track { background: rgba(28, 16, 40, 0.8); }
        .demand-sentinel-root ::-webkit-scrollbar-thumb { background: var(--border); border-radius: 3px; }
      `}</style>

      <div className="demand-sentinel-root" style={{ minHeight: "100vh", background: T.bg, fontFamily: "'Sora', sans-serif", color: T.text }}>
        {/* Header — Y3 violet strip */}
        <div style={{
          background: "linear-gradient(90deg, var(--brand-dim) 0%, var(--surface) 45%, rgba(107, 45, 145, 0.35) 100%)",
          borderBottom: `1px solid ${T.border}`,
          padding: "0 32px",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          height: 60, position: "sticky", top: 0, zIndex: 100
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <PulsingDot color="var(--brand-bright)" />
            <span style={{ color: "#f4eef9", fontWeight: 700, fontSize: 15, letterSpacing: "-0.01em" }}>
              Demand Sentinel
            </span>
            <span style={{
              background: T.surfaceLift, color: "var(--brand-bright)", fontSize: 11,
              padding: "3px 10px", borderRadius: 20, fontFamily: "JetBrains Mono, monospace",
              border: `1px solid ${T.border}`
            }}>
              frePPLe · Manufacturing DB
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
            <span style={{ color: T.muted, fontSize: 12, fontFamily: "JetBrains Mono, monospace" }}>
              {now}
            </span>
            <button
              onClick={() => setTick(t => t + 1)}
              style={{
                background: T.surface, border: `1px solid ${T.border}`, color: T.muted,
                padding: "6px 14px", borderRadius: 8, fontSize: 12, cursor: "pointer",
                display: "flex", alignItems: "center", gap: 6, transition: ".15s"
              }}
            >
              ↻ Refresh
            </button>
          </div>
        </div>

        <div style={{ maxWidth: 1100, margin: "0 auto", padding: "32px 24px" }}>
          {/* Page title */}
          <div style={{ marginBottom: 28 }}>
            <h1 style={{ fontSize: 26, fontWeight: 700, color: T.text, marginBottom: 6, letterSpacing: "-0.02em" }}>
              Forecast Bias & Volatility Report
            </h1>
            <div style={{ fontSize: 13, color: T.muted }}>
              Data sources: <code style={{ background: T.surfaceLift, padding: "1px 6px", borderRadius: 4, fontSize: 12, color: "var(--brand-bright)", border: `1px solid ${T.border}` }}>forecast</code>
              {" "}<code style={{ background: T.surfaceLift, padding: "1px 6px", borderRadius: 4, fontSize: 12, color: "var(--brand-bright)", border: `1px solid ${T.border}` }}>forecastplan</code>
              {" "}<code style={{ background: T.surfaceLift, padding: "1px 6px", borderRadius: 4, fontSize: 12, color: "var(--brand-bright)", border: `1px solid ${T.border}` }}>customer</code>
              {" "}<code style={{ background: T.surfaceLift, padding: "1px 6px", borderRadius: 4, fontSize: 12, color: "var(--brand-bright)", border: `1px solid ${T.border}` }}>demand</code>
              {" "}· Exception trigger: MAPE &gt; 25% for Category A over 2 periods
            </div>
          </div>

          {/* Tabs */}
          <div style={{ display: "flex", gap: 0, borderBottom: `2px solid ${T.border}`, marginBottom: 28 }}>
            {TABS.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                style={{
                  background: "none", border: "none", borderBottom: activeTab === tab.id ? "2px solid var(--brand-bright)" : "2px solid transparent",
                  marginBottom: -2, padding: "10px 20px", fontSize: 13, fontWeight: activeTab === tab.id ? 700 : 500,
                  color: activeTab === tab.id ? "var(--brand-bright)" : T.muted, cursor: "pointer", transition: ".15s",
                  display: "flex", alignItems: "center", gap: 7, fontFamily: "'Sora', sans-serif"
                }}
              >
                {tab.label}
                {tab.count !== undefined && (
                  <span style={{
                    background: "rgba(248, 113, 113, 0.18)", color: "#fca5a5",
                    borderRadius: 20, padding: "1px 7px", fontSize: 11, fontWeight: 700
                  }}>{tab.count}</span>
                )}
              </button>
            ))}
          </div>

          {/* Tab content */}
          {activeTab === "report" && <ReportTab key={tick} />}
          {activeTab === "exceptions" && <ExceptionsTab />}
          {activeTab === "scenario" && <ScenarioTab />}
          {activeTab === "data" && <ShortageTab />}

          {/* Footer */}
          <div style={{ marginTop: 40, paddingTop: 20, borderTop: `1px solid ${T.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 12, color: T.muted, fontFamily: "JetBrains Mono, monospace" }}>
              DemandSentinel v1.0 · Static data mode
            </span>
            <div style={{ display: "flex", gap: 8 }}>
              <Badge label="To make dynamic: wire FORECAST_DATA to frePPLe API" color="var(--brand-bright)" bg="rgba(142, 77, 196, 0.2)" />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
