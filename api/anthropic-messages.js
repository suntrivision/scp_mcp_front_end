import { proxyAnthropicMessages } from "../server/anthropic-proxy.mjs";

/**
 * Vercel Serverless: proxies Anthropic Messages API so the API key stays in
 * Vercel Environment Variables (ANTHROPIC_API_KEY) — never bundled in the client.
 */
export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const body = req.body;
  if (!body || typeof body !== "object") {
    return res.status(400).json({ error: "JSON body required" });
  }

  try {
    const { status, text } = await proxyAnthropicMessages(body);
    res.status(status);
    res.setHeader("Content-Type", "application/json");
    return res.send(text);
  } catch (e) {
    const code = e.statusCode || 500;
    return res.status(code).json({ error: e.message || "Anthropic proxy error" });
  }
}
