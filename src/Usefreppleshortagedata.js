import { useState, useCallback, useEffect } from "react";

// ── Dynamic Inventory Shortage: same path as AI Reporting Agent ───────────────
// POST /api/frepple/inventory-shortage → local Express or Vercel → FREPPLE_BACKEND_URL
// Claude CLI + Y3 MCP (no Anthropic remote MCP URL in the browser).

// ── Helper: parse frePPLe delay string → decimal days ────────────────────────
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

  const fetchReport = useCallback(async () => {
    setLoading(true);
    setError(null);
    setData(null);

    try {
      setStatusMsg("Running inventory shortage analysis (Y3 MCP via backend)…");

      const response = await fetch("/api/frepple/inventory-shortage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
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

      const report = payload.data;
      if (!report || typeof report !== "object") {
        throw new Error("Invalid response: expected { data: { … } } from backend");
      }

      setStatusMsg("Parsing results…");

      const required = ["snapshot", "delayed_pos", "demand_at_risk", "root_causes", "actions"];
      for (const key of required) {
        if (!report[key]) throw new Error(`Missing field: ${key}`);
      }

      setData(report);
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
