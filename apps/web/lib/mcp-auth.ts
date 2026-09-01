import { basicAuthOk } from "./auth";

/**
 * Auth for the remote MCP endpoint. The route executes LLM-generated Python and
 * calls a paid model, so it must never be more open than the site's own gate.
 *
 * Two credentials are accepted, in the shape each caller naturally has:
 *   - `Authorization: Bearer <MCP_TOKEN>` — what an MCP host sends (Claude Code
 *     and friends let you set a static header, but not a browser login).
 *   - `Authorization: Basic <SITE_USER:SITE_PASSWORD>` — the same credential
 *     that gates the web app, so a reviewer already holding it can point a
 *     client at the endpoint without a second secret.
 *
 * If NEITHER env var is set the endpoint is open — which is exactly local dev,
 * and matches how the site gate itself is inert without SITE_PASSWORD.
 */

export interface McpAuthConfig {
  token?: string | undefined;
  siteUser?: string | undefined;
  sitePassword?: string | undefined;
}

type Env = Record<string, string | undefined>;

export function mcpAuthConfigFromEnv(env: Env = process.env): McpAuthConfig {
  return {
    token: env.MCP_TOKEN,
    siteUser: env.SITE_USER ?? "julius",
    sitePassword: env.SITE_PASSWORD,
  };
}

/** Constant-time string comparison, so a token can't be probed byte by byte. */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/**
 * True if the request may use the MCP endpoint. Open only when no credential is
 * configured at all — never "open because the header was missing".
 */
export function mcpAuthOk(header: string | null, config: McpAuthConfig): boolean {
  const { token, sitePassword } = config;
  if (!token && !sitePassword) return true;

  if (token && header?.startsWith("Bearer ") && safeEqual(header.slice(7).trim(), token)) {
    return true;
  }
  if (sitePassword && basicAuthOk(header, config.siteUser ?? "julius", sitePassword)) {
    return true;
  }
  return false;
}
