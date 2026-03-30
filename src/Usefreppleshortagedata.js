import { useState, useCallback, useEffect, useRef } from "react";

// ── Dynamic Inventory Shortage: same path as AI Reporting Agent ───────────────
// POST /api/frepple/query { mode: inventory_shortage } → Claude CLI + Y3 MCP on backend.

/** UI stages while the single long request runs (no server-side streaming). */
export const DYNAMIC_SHORTAGE_PROGRESS_STEPS = [
  { label: "Sending request to the planning backend", detail: "POST /api/frepple/query · mode inventory_shortage" },
  { label: "Backend is running Claude with Y3 MCP", detail: "Purchase orders, sales orders, manufacturing orders" },
  { label: "Analysing delays, demand risk, and root causes", detail: "Severity, pegging, and planning gaps" },
  { label: "Building the shortage report JSON", detail: "Snapshot, tabs, actions" },
];

// ── Helper: parse frePPLe delay string → decimal days ────────────────────────
const SHORTAGE_KEYS = ["snapshot", "delayed_pos", "demand_at_risk", "root_causes", "actions"];

function looksLikeShortageReport(o) {
  if (!o || typeof o !== "object") return false;
  return SHORTAGE_KEYS.every((k) => k in o);
}

/** Resolve report object from API payload (supports { data }, flat body, and clearer errors). */
function extractShortageReport(payload) {
  if (!payload || typeof payload !== "object") {
    throw new Error("Empty or invalid JSON from backend.");
  }

  if (payload.data != null && typeof payload.data === "object" && looksLikeShortageReport(payload.data)) {
    return payload.data;
  }

  if (looksLikeShortageReport(payload)) {
    return payload;
  }

  const keys = Object.keys(payload);
  if (
    "intent" in payload ||
    typeof payload.summary === "string" ||
    Array.isArray(payload.rows)
  ) {
    throw new Error(
      "The planning backend returned a normal reporting response (intent/summary/rows), not Dynamic Inventory data. " +
        "It likely ignores mode: \"inventory_shortage\". On the server that owns POST /api/frepple/query, add the branch from this repo's server/index.mjs (handleInventoryShortage when body.mode === \"inventory_shortage\"), then redeploy."
    );
  }

  throw new Error(
    "Invalid response: expected { data: { snapshot, delayed_pos, demand_at_risk, root_causes, actions } }. " +
      `Got keys: ${keys.slice(0, 14).join(", ") || "(none)"}${keys.length > 14 ? "…" : ""}`
  );
}

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

export function useFreppleShortageData() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [statusMsg, setStatusMsg] = useState("");
  /** 0 .. DYNAMIC_SHORTAGE_PROGRESS_STEPS.length - 1 while loading */
  const [progressStep, setProgressStep] = useState(0);
  const progressTimersRef = useRef([]);

  const clearProgressTimers = useCallback(() => {
    progressTimersRef.current.forEach((id) => clearTimeout(id));
    progressTimersRef.current = [];
  }, []);

  const fetchReport = useCallback(async () => {
    setLoading(true);
    setError(null);
    setData(null);
    clearProgressTimers();

    const steps = DYNAMIC_SHORTAGE_PROGRESS_STEPS;
    setProgressStep(0);
    setStatusMsg(steps[0].label);

    const stepDelaysMs = [2200, 11000, 26000];
    stepDelaysMs.forEach((ms, idx) => {
      const step = idx + 1;
      const id = setTimeout(() => {
        setProgressStep(step);
        setStatusMsg(steps[step].label);
      }, ms);
      progressTimersRef.current.push(id);
    });

    try {
      // Same endpoint as AI Reporting Agent — avoids 404 on backends that only expose /api/frepple/query
      const response = await fetch("/api/frepple/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "inventory_shortage",
          message: "inventory_shortage",
        }),
      });

      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        const msg =
          typeof payload.error === "string"
            ? payload.error
            : payload.error?.message || `Request failed (${response.status})`;
        throw new Error(msg);
      }

      if (payload.error) {
        const e = payload.error;
        throw new Error(typeof e === "string" ? e : e.message || JSON.stringify(e));
      }

      const report = extractShortageReport(payload);

      setProgressStep(steps.length - 1);
      setStatusMsg("Validating report…");

      for (const key of SHORTAGE_KEYS) {
        if (!report[key]) throw new Error(`Missing field: ${key}`);
      }

      setData(report);
      setStatusMsg("");
    } catch (e) {
      setError(e.message || "Unknown error");
      setStatusMsg("");
    } finally {
      clearProgressTimers();
      setLoading(false);
    }
  }, [clearProgressTimers]);

  useEffect(() => {
    void fetchReport();
  }, [fetchReport]);

  return {
    data,
    loading,
    error,
    statusMsg,
    progressStep,
    progressSteps: DYNAMIC_SHORTAGE_PROGRESS_STEPS,
    fetchReport,
  };
}
