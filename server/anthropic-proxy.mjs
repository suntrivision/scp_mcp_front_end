const ANTHROPIC_MESSAGES_URL = "https://api.anthropic.com/v1/messages";

/**
 * Resolve API key: prefer server-only ANTHROPIC_API_KEY (Vercel Secret / local .env).
 * Falls back to VITE_ANTHROPIC_KEY when present in .env for local migration.
 */
export function getAnthropicApiKey() {
  const a = process.env.ANTHROPIC_API_KEY;
  const b = process.env.VITE_ANTHROPIC_KEY;
  const key = (typeof a === "string" && a.trim()) || (typeof b === "string" && b.trim());
  return key || "";
}

/**
 * Optional Bearer for remote MCP (set FREPPLE_MCP_AUTHORIZATION_TOKEN on Vercel / .env — not VITE_*).
 */
function injectFreppleMcpAuth(body) {
  if (!body || typeof body !== "object") return body;
  const token = process.env.FREPPLE_MCP_AUTHORIZATION_TOKEN?.trim();
  if (!token || !Array.isArray(body.mcp_servers)) return body;
  return {
    ...body,
    mcp_servers: body.mcp_servers.map((s) =>
      s && s.name === "frepple" && !s.authorization_token
        ? { ...s, authorization_token: token }
        : s
    ),
  };
}

/**
 * Forward a Messages API request body to Anthropic (MCP + tools supported).
 * @returns {{ status: number, text: string }}
 */
export async function proxyAnthropicMessages(body) {
  const key = getAnthropicApiKey();
  if (!key) {
    const err = new Error(
      "Missing ANTHROPIC_API_KEY. For Vercel: add it under Project → Settings → Environment Variables (Sensitive). For local dev: set it in .env next to vite.config.js and restart the API server."
    );
    err.statusCode = 500;
    throw err;
  }

  const payload = injectFreppleMcpAuth(body);

  const r = await fetch(ANTHROPIC_MESSAGES_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
      "anthropic-beta": "mcp-client-2025-11-20",
    },
    body: JSON.stringify(payload),
  });

  const text = await r.text();
  return { status: r.status, text };
}
