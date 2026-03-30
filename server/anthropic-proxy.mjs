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
 * Bearer token Anthropic sends to the remote MCP as `authorization_token` (see MCP connector docs).
 * Use FREPPLE_MCP_AUTHORIZATION_TOKEN, or FREPPLE_TOKEN if you already use that name (same value).
 */
function getFreppleMcpAuthorizationToken() {
  const a = process.env.FREPPLE_MCP_AUTHORIZATION_TOKEN;
  const b = process.env.FREPPLE_TOKEN;
  return (typeof a === "string" && a.trim()) || (typeof b === "string" && b.trim()) || "";
}

function injectFreppleMcpAuth(body) {
  if (!body || typeof body !== "object") return body;
  const token = getFreppleMcpAuthorizationToken();
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
