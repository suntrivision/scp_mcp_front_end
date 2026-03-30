import { useState } from "react";
import { useFreppleShortageData } from "./Usefreppleshortagedata.js";

// ── Fallback static data (shown before first live fetch) ──────────────────────
const STATIC_DATA = {
  snapshot: { overdue_pos: 8, items_at_risk: 5, unplanned_orders: 1, max_delay_days: 45.1 },
  delayed_pos: [
    { ref: "Ref 163", item: "Wooden beam",  supplier: "Wood supplier",    qty: 400,  arrival: "28 Apr 2026", delay_days: 45.1, severity: "Critical", pegged_demands: ["Demand 03","Demand 04","Demand 07"] },
    { ref: "Ref 129", item: "Chair",         supplier: "Chair supplier",   qty: 700,  arrival: "28 Apr 2026", delay_days: 37.3, severity: "Critical", pegged_demands: ["Demand 06","Demand 12","Demand 13"] },
    { ref: "Ref 143", item: "Cushion",       supplier: "Cushion supplier", qty: 200,  arrival: "20 Apr 2026", delay_days: 31.7, severity: "Critical", pegged_demands: ["Demand 03","Demand 07"] },
    { ref: "Ref 155", item: "Screws",        supplier: "Screw supplier",   qty: 3000, arrival: "13 Apr 2026", delay_days: 24.2, severity: "Critical", pegged_demands: ["Demand 03","Demand 04"] },
    { ref: "PO#4",    item: "Cushion",       supplier: "Cushion supplier", qty: 100,  arrival: "2 Apr 2026",  delay_days: 13.2, severity: "High",     pegged_demands: ["Demand 11"] },
    { ref: "PO#2",    item: "Wooden beam",   supplier: "Wood supplier",    qty: 100,  arrival: "2 Apr 2026",  delay_days: 10.9, severity: "High",     pegged_demands: ["Demand 08"] },
    { ref: "PO#3",    item: "Screws",        supplier: "Screw supplier",   qty: 100,  arrival: "29 Mar 2026", delay_days: 6.0,  severity: "Late",     pegged_demands: ["chair @ shop 2"] },
    { ref: "PO#1",    item: "Wooden panel",  supplier: "Wood supplier",    qty: 100,  arrival: "29 Mar 2026", delay_days: 3.6,  severity: "Late",     pegged_demands: ["Demand 04"] },
  ],
  demand_at_risk: [
    { order: "SO-Teh-001",   item: "Teh Kering",              customer: "Customer A", due: "4 Apr 2026",    qty: 100,        issue: "No delivery planned" },
    { order: "Demand 03–07", item: "Chair",                   customer: "Various",    due: "Apr 2026",       qty: "Multiple", issue: "Supply delayed 31–45 days" },
    { order: "Demand 12–15", item: "Chair / Varnished chair", customer: "Various",    due: "Apr–May 2026",   qty: "Multiple", issue: "Supply delayed 37 days" },
  ],
  root_causes: [
    { title: "Chair supply plan 37+ days behind schedule",    description: "PO Ref 129 (700 chairs) is delayed 37+ days, blocking Demands 06 and 12–15 across shop 1 and shop 2 through April–May 2026.", affected_items: ["Chair","Varnished chair","shop 1","shop 2"], severity_pct: 100, type: "supplier_late" },
    { title: "Cushion shortage creating assembly bottleneck", description: "PO#4 (confirmed, 13 days late) and Ref 143 (proposed, 31+ days late) feed chair assembly. Shortages cascade into finished chair availability.", affected_items: ["Chair","Varnished chair","shop 1","shop 2"], severity_pct: 90, type: "component_shortage" },
    { title: "Wood supplier systemic lateness",               description: "Wood supplier appears on 3+ delayed POs and is consistently late across the planning horizon through 2027. Supplier performance issue, not isolated.", affected_items: ["Wooden beam","Wooden panel","Chair","Round table"], severity_pct: 75, type: "systemic_supplier" },
    { title: "Teh Kering planning gap",                       description: "SO-Teh-001 has a raw material PO (Pucuk Teh) but no finished goods delivery order. Plan not regenerated or BOM route incomplete.", affected_items: ["Teh Kering","Customer A"], severity_pct: 55, type: "planning_gap" },
  ],
  actions: [
    { rank: 1, action: "Expedite PO#2 (wooden beam) and PO#4 (cushion) — both confirmed and overdue today, feeding imminent chair production", priority: "Urgent" },
    { rank: 2, action: "Investigate SO-Teh-001 planning gap — no delivery order exists despite raw material PO being linked to the order", priority: "Urgent" },
    { rank: 3, action: "Re-run the Y3 plan after expediting chair PO Ref 129 — 700-unit batch is 37 days late and blocks all April–May demand", priority: "High" },
    { rank: 4, action: "Review wood supplier performance; consider qualifying a secondary supplier given systemic lateness across 30+ POs", priority: "High" },
    { rank: 5, action: "Confirm cushion supplier capacity for Ref 143 — 31-day delay suggests a supplier constraint, not just a scheduling issue", priority: "High" },
  ],
};

// ── Style maps ────────────────────────────────────────────────────────────────
const SEVERITY_STYLE = {
  Critical: { bg: "#fef2f2", color: "#b91c1c", border: "#fecaca" },
  High:     { bg: "#fffbeb", color: "#92400e", border: "#fde68a" },
  Late:     { bg: "#fefce8", color: "#854d0e", border: "#fef08a" },
};
const PRIORITY_STYLE = {
  Urgent: { bg: "#fef2f2", color: "#b91c1c" },
  High:   { bg: "#fffbeb", color: "#92400e" },
  Medium: { bg: "#f0fdf4", color: "#166534" },
};
const RC_COLOR = {
  systemic_supplier:  "#ef4444",
  component_shortage: "#f97316",
  supplier_late:      "#f59e0b",
  planning_gap:       "#3b82f6",
};
const RC_ICON = {
  systemic_supplier:  "⚠",
  component_shortage: "⛓",
  supplier_late:      "⏱",
  planning_gap:       "○",
};

// ── Tiny sub-components ───────────────────────────────────────────────────────
function Badge({ label, bg, color, border }) {
  return (
    <span style={{ display:"inline-block", padding:"2px 9px", borderRadius:4, fontSize:11, fontWeight:600, letterSpacing:"0.02em", background:bg, color, border:`1px solid ${border||bg}` }}>
      {label}
    </span>
  );
}

function SectionHeader({ title }) {
  return (
    <div style={{ fontSize:11, fontWeight:700, color:"#94a3b8", letterSpacing:"0.1em", textTransform:"uppercase", borderBottom:"1px solid #e2e8f0", paddingBottom:8, marginBottom:16 }}>
      {title}
    </div>
  );
}

function MetricCard({ label, value, color }) {
  return (
    <div style={{ background:"#f8fafc", border:"1px solid #e2e8f0", borderRadius:10, padding:"16px 20px", flex:1, minWidth:130 }}>
      <div style={{ fontSize:12, color:"#64748b", marginBottom:6, fontWeight:500 }}>{label}</div>
      <div style={{ fontSize:26, fontWeight:700, color: color || "#0f172a", lineHeight:1 }}>{value}</div>
    </div>
  );
}

function DelayBar({ days, max }) {
  const pct = Math.min((days / max) * 100, 100);
  const color = days >= 30 ? "#ef4444" : days >= 10 ? "#f59e0b" : "#eab308";
  return (
    <div style={{ display:"flex", alignItems:"center", gap:8 }}>
      <div style={{ flex:1, height:5, background:"#f1f5f9", borderRadius:99, overflow:"hidden" }}>
        <div style={{ width:`${pct}%`, height:"100%", background:color, borderRadius:99 }} />
      </div>
      <span style={{ fontSize:12, fontWeight:600, color, minWidth:42, textAlign:"right" }}>{days}d</span>
    </div>
  );
}

// ── Shimmer loading skeleton ──────────────────────────────────────────────────
function Shimmer({ h = 20, w = "100%", r = 6, mb = 0 }) {
  return (
    <div style={{
      height: h, width: w, borderRadius: r, marginBottom: mb,
      background: "linear-gradient(90deg,#f1f5f9 25%,#e2e8f0 50%,#f1f5f9 75%)",
      backgroundSize: "200% 100%",
      animation: "frepple-shimmer 1.4s infinite",
    }} />
  );
}

function LoadingSkeleton({ statusMsg }) {
  return (
    <div style={{ padding:"28px 24px", fontFamily:"'DM Sans','Helvetica Neue',sans-serif", maxWidth:900, margin:"0 auto" }}>
      <style>{`@keyframes frepple-shimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}`}</style>
      <Shimmer h={28} w={280} mb={8} />
      <Shimmer h={14} w={200} mb={28} />
      <div style={{ display:"flex", gap:12, marginBottom:32 }}>
        {[1,2,3,4].map(i => <Shimmer key={i} h={80} r={10} w="25%" />)}
      </div>
      <Shimmer h={14} w={160} mb={16} />
      <Shimmer h={200} r={10} mb={32} />
      <Shimmer h={14} w={160} mb={16} />
      {[1,2,3].map(i => <Shimmer key={i} h={64} r={10} mb={10} />)}
      <p style={{ textAlign:"center", fontSize:13, color:"#64748b", marginTop:20 }}>{statusMsg || "Connecting to planning data…"}</p>
    </div>
  );
}

// ── Error state ───────────────────────────────────────────────────────────────
function ErrorState({ error, onRetry }) {
  return (
    <div style={{ padding:"28px 24px", fontFamily:"'DM Sans','Helvetica Neue',sans-serif", maxWidth:900, margin:"0 auto" }}>
      <div style={{ background:"#fef2f2", border:"1px solid #fecaca", borderRadius:10, padding:"20px 24px" }}>
        <div style={{ fontWeight:600, color:"#b91c1c", marginBottom:8, fontSize:15 }}>Failed to load live shortage data</div>
        <code style={{ display:"block", fontSize:12, color:"#7f1d1d", marginBottom:16, whiteSpace:"pre-wrap", background:"#fff5f5", padding:"10px 12px", borderRadius:6 }}>{error}</code>
        <p style={{ fontSize:13, color:"#475569", marginBottom:12 }}>Common fixes:</p>
        <ul style={{ fontSize:13, color:"#475569", margin:"0 0 16px 16px", lineHeight:2 }}>
          <li>Same setup as <strong>AI Reporting Agent</strong>: run <code>npm run dev</code> (API + Vite) and ensure Claude Code can reach Y3 MCP</li>
          <li>On Vercel: set <code>FREPPLE_BACKEND_URL</code> to the public URL of the server that implements <code>POST /api/frepple/inventory-shortage</code> (same host as <code>/api/frepple/query</code>)</li>
          <li>That backend must run the Claude CLI path (see <code>server/index.mjs</code>) or an equivalent in your MCPSCP deployment</li>
        </ul>
        <button type="button" onClick={onRetry} style={{ padding:"8px 18px", background:"#0f172a", color:"#fff", border:"none", borderRadius:7, fontSize:13, fontWeight:600, cursor:"pointer" }}>
          ↻ Retry
        </button>
      </div>
    </div>
  );
}

// ── The actual report view (pure, receives data as prop) ──────────────────────
function ReportView({ data }) {
  const [expandedRC, setExpandedRC] = useState(null);
  const [activeTab, setActiveTab]   = useState("pos");
  const { snapshot, delayed_pos, demand_at_risk, root_causes, actions } = data;
  const maxDelay = Math.max(...delayed_pos.map(p => p.delay_days), 1);

  const tabStyle = (id) => ({
    padding:"7px 16px", borderRadius:6, fontSize:13, fontWeight:500,
    cursor:"pointer", border:"none",
    background: activeTab === id ? "#0f172a" : "transparent",
    color:      activeTab === id ? "#fff"     : "#64748b",
    transition: "all 0.15s",
  });

  return (
    <div style={{ fontFamily:"'DM Sans','Helvetica Neue',sans-serif", maxWidth:900, margin:"0 auto", padding:"28px 24px", color:"#0f172a", lineHeight:1.6 }}>

      {/* ── Header ── */}
      <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", flexWrap:"wrap", gap:12, marginBottom:28 }}>
        <div>
          <h1 style={{ fontSize:22, fontWeight:700, margin:0, letterSpacing:"-0.02em" }}>Inventory Shortage Report</h1>
          <p style={{ fontSize:13, color:"#64748b", margin:"4px 0 0" }}>
            Y3 · Live data · {new Date().toLocaleDateString("en-AU",{day:"numeric",month:"short",year:"numeric"})}
          </p>
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:6, background:"#fef2f2", border:"1px solid #fecaca", borderRadius:8, padding:"6px 12px" }}>
          <span style={{ width:7, height:7, borderRadius:"50%", background:"#ef4444", display:"inline-block" }} />
          <span style={{ fontSize:12, fontWeight:600, color:"#b91c1c" }}>{snapshot.overdue_pos} overdue purchase orders</span>
        </div>
      </div>

      {/* ── Metrics ── */}
      <div style={{ marginBottom:32 }}>
        <SectionHeader title="Shortage snapshot — next 4–8 weeks" />
        <div style={{ display:"flex", gap:12, flexWrap:"wrap" }}>
          <MetricCard label="Overdue purchase orders" value={snapshot.overdue_pos}        color="#ef4444" />
          <MetricCard label="Items at risk"           value={snapshot.items_at_risk}      color="#f59e0b" />
          <MetricCard label="Unplanned orders"        value={snapshot.unplanned_orders}   color="#f59e0b" />
          <MetricCard label="Max delay detected"      value={`${snapshot.max_delay_days}d`} color="#ef4444" />
        </div>
      </div>

      {/* ── Tabbed tables ── */}
      <div style={{ marginBottom:32 }}>
        <SectionHeader title="Supply detail" />
        <div style={{ display:"flex", gap:4, marginBottom:16, background:"#f1f5f9", borderRadius:8, padding:4, width:"fit-content" }}>
          <button type="button" style={tabStyle("pos")}    onClick={() => setActiveTab("pos")}>    Delayed POs ({delayed_pos.length})</button>
          <button type="button" style={tabStyle("demand")} onClick={() => setActiveTab("demand")}> Demand at risk ({demand_at_risk.length})</button>
        </div>

        {activeTab === "pos" && (
          <div style={{ overflowX:"auto" }}>
            <table style={{ width:"100%", borderCollapse:"collapse", fontSize:13 }}>
              <thead>
                <tr style={{ background:"#f8fafc" }}>
                  {["PO ref","Item","Supplier","Qty","Expected arrival","Delay","Severity"].map(h => (
                    <th key={h} style={{ textAlign:"left", padding:"9px 12px", fontWeight:600, fontSize:12, color:"#64748b", borderBottom:"1px solid #e2e8f0", whiteSpace:"nowrap" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {delayed_pos.map((po, i) => (
                  <tr key={po.ref} style={{ background: i % 2 === 0 ? "#fff" : "#fafafa" }}>
                    <td style={{ padding:"10px 12px", borderBottom:"1px solid #f1f5f9", fontWeight:600, fontFamily:"monospace", fontSize:12 }}>{po.ref}</td>
                    <td style={{ padding:"10px 12px", borderBottom:"1px solid #f1f5f9", fontWeight:500 }}>{po.item}</td>
                    <td style={{ padding:"10px 12px", borderBottom:"1px solid #f1f5f9", color:"#475569" }}>{po.supplier}</td>
                    <td style={{ padding:"10px 12px", borderBottom:"1px solid #f1f5f9", color:"#475569" }}>{Number(po.qty).toLocaleString()}</td>
                    <td style={{ padding:"10px 12px", borderBottom:"1px solid #f1f5f9", color:"#475569", whiteSpace:"nowrap" }}>{po.arrival}</td>
                    <td style={{ padding:"10px 12px", borderBottom:"1px solid #f1f5f9", minWidth:130 }}>
                      <DelayBar days={po.delay_days} max={maxDelay} />
                    </td>
                    <td style={{ padding:"10px 12px", borderBottom:"1px solid #f1f5f9" }}>
                      <Badge label={po.severity} {...SEVERITY_STYLE[po.severity]} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === "demand" && (
          <div style={{ overflowX:"auto" }}>
            <table style={{ width:"100%", borderCollapse:"collapse", fontSize:13 }}>
              <thead>
                <tr style={{ background:"#f8fafc" }}>
                  {["Order","Item","Customer","Due","Qty","Issue"].map(h => (
                    <th key={h} style={{ textAlign:"left", padding:"9px 12px", fontWeight:600, fontSize:12, color:"#64748b", borderBottom:"1px solid #e2e8f0" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {demand_at_risk.map((d, i) => (
                  <tr key={d.order} style={{ background: i % 2 === 0 ? "#fff" : "#fafafa" }}>
                    <td style={{ padding:"10px 12px", borderBottom:"1px solid #f1f5f9", fontWeight:600, fontFamily:"monospace", fontSize:12 }}>{d.order}</td>
                    <td style={{ padding:"10px 12px", borderBottom:"1px solid #f1f5f9", fontWeight:500 }}>{d.item}</td>
                    <td style={{ padding:"10px 12px", borderBottom:"1px solid #f1f5f9", color:"#475569" }}>{d.customer}</td>
                    <td style={{ padding:"10px 12px", borderBottom:"1px solid #f1f5f9", color:"#475569", whiteSpace:"nowrap" }}>{d.due}</td>
                    <td style={{ padding:"10px 12px", borderBottom:"1px solid #f1f5f9", color:"#475569" }}>{d.qty}</td>
                    <td style={{ padding:"10px 12px", borderBottom:"1px solid #f1f5f9" }}>
                      <Badge
                        label={d.issue}
                        bg={d.issue === "No delivery planned" ? "#fef2f2" : "#fffbeb"}
                        color={d.issue === "No delivery planned" ? "#b91c1c" : "#92400e"}
                        border={d.issue === "No delivery planned" ? "#fecaca" : "#fde68a"}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Root causes ── */}
      <div style={{ marginBottom:32 }}>
        <SectionHeader title="Root cause analysis" />
        <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
          {root_causes.map((rc, i) => {
            const barColor = RC_COLOR[rc.type] || "#64748b";
            const isOpen   = expandedRC === i;
            return (
              <div key={i}
                onClick={() => setExpandedRC(isOpen ? null : i)}
                style={{ background:"#fff", border:"1px solid #e2e8f0", borderLeft:`4px solid ${barColor}`, borderRadius:"0 10px 10px 0", padding:"14px 16px", cursor:"pointer" }}
                onMouseEnter={e => e.currentTarget.style.boxShadow = "0 2px 8px rgba(0,0,0,0.06)"}
                onMouseLeave={e => e.currentTarget.style.boxShadow = "none"}
              >
                <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", gap:12 }}>
                  <div style={{ flex:1 }}>
                    <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:4 }}>
                      <span style={{ fontSize:14, color:barColor }}>{RC_ICON[rc.type] || "•"}</span>
                      <span style={{ fontWeight:600, fontSize:14 }}>{rc.title}</span>
                    </div>
                    {isOpen && (
                      <p style={{ fontSize:13, color:"#475569", margin:"6px 0 10px", lineHeight:1.6 }}>{rc.description}</p>
                    )}
                    <div style={{ display:"flex", flexWrap:"wrap", gap:5, marginTop: isOpen ? 0 : 6 }}>
                      {(rc.affected_items || []).map(item => (
                        <span key={item} style={{ fontSize:11, padding:"1px 7px", borderRadius:4, background:"#f1f5f9", color:"#475569", fontWeight:500 }}>{item}</span>
                      ))}
                    </div>
                  </div>
                  <div style={{ display:"flex", flexDirection:"column", alignItems:"flex-end", gap:6, minWidth:90 }}>
                    <span style={{ fontSize:12, fontWeight:700, color:barColor }}>{rc.severity_pct}%</span>
                    <div style={{ width:80, height:5, background:"#f1f5f9", borderRadius:99, overflow:"hidden" }}>
                      <div style={{ width:`${rc.severity_pct}%`, height:"100%", background:barColor, borderRadius:99 }} />
                    </div>
                    <span style={{ fontSize:11, color:"#94a3b8" }}>{isOpen ? "▲ collapse" : "▼ expand"}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Actions ── */}
      <div>
        <SectionHeader title="Recommended actions" />
        <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
          {actions.map(a => (
            <div key={a.rank} style={{ display:"flex", alignItems:"flex-start", gap:14, background:"#fff", border:"1px solid #e2e8f0", borderRadius:10, padding:"13px 16px" }}>
              <div style={{ width:26, height:26, borderRadius:"50%", background:"#0f172a", color:"#fff", display:"flex", alignItems:"center", justifyContent:"center", fontSize:12, fontWeight:700, flexShrink:0, marginTop:1 }}>
                {a.rank}
              </div>
              <div style={{ flex:1, fontSize:13, color:"#0f172a", lineHeight:1.6 }}>{a.action}</div>
              <Badge label={a.priority} bg={PRIORITY_STYLE[a.priority]?.bg || "#f1f5f9"} color={PRIORITY_STYLE[a.priority]?.color || "#475569"} />
            </div>
          ))}
        </div>
      </div>

      <div style={{ marginTop:32, paddingTop:16, borderTop:"1px solid #e2e8f0", fontSize:12, color:"#94a3b8", textAlign:"center" }}>
        Y3 · Live data · {new Date().toLocaleDateString("en-AU",{day:"numeric",month:"short",year:"numeric"})}
      </div>
    </div>
  );
}

// ── Shell: handles loading / error / refresh bar, renders ReportView ──────────
export default function DynamicInventoryShortageReport() {
  const { data, loading, error, statusMsg, fetchReport } = useFreppleShortageData();

  const displayData = data || STATIC_DATA;
  const isLive      = !!data;

  if (loading) return <LoadingSkeleton statusMsg={statusMsg} />;
  if (error)   return <ErrorState error={error} onRetry={fetchReport} />;

  return (
    <>
      <div style={{ background:"#f8fafc", borderBottom:"1px solid #e2e8f0", padding:"9px 24px", display:"flex", alignItems:"center", gap:12, fontFamily:"'DM Sans','Helvetica Neue',sans-serif" }}>
        <span style={{ flex:1, fontSize:12, color: isLive ? "#16a34a" : "#94a3b8" }}>
          {isLive ? "✓ Live data loaded from planning (Y3 / frePPLe MCP)" : "Showing sample data — click refresh to reload from API"}
        </span>
        <button
          type="button"
          onClick={() => void fetchReport()}
          style={{ padding:"7px 16px", background:"#0f172a", color:"#fff", border:"none", borderRadius:7, fontSize:13, fontWeight:600, cursor:"pointer" }}
        >
          ↻ Refresh live data
        </button>
      </div>

      <ReportView data={displayData} />
    </>
  );
}
