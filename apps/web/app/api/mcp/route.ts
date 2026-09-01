import { handleMcpHttpRequest } from "@julius/mcp-server/http";
import { getService } from "@/lib/core";
import { repositories } from "@/lib/db";
import { getAnalytics } from "@/lib/analytics";
import { mcpAuthConfigFromEnv, mcpAuthOk } from "@/lib/mcp-auth";
import { rateLimited } from "@/lib/ratelimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// run_analysis does the full loop (sandbox + LLM), same budget as /api/analyze.
export const maxDuration = 60;

/**
 * The remote MCP endpoint — the reason this deployment is pilotable by an
 * external agent at all. Julius is an MCP *client*: it ships no MCP server and
 * no public API, so a hosted endpoint over the analyst surface is the gap this
 * project fills, and a gap you can only demo if it answers at a URL rather than
 * only over local stdio.
 *
 * The tools come from `@julius/mcp-server` — byte-for-byte the ones the stdio
 * entry point registers, over the same core the UI calls. This file adds auth,
 * rate limiting, and the deployment's core handle; nothing analyst-shaped. If
 * wiring a second transport had needed a second implementation of the tools,
 * the "one core, many clients" seam would have been decoration. It didn't.
 */

function unauthorized(): Response {
  return Response.json(
    { jsonrpc: "2.0", error: { code: -32001, message: "Unauthorized" }, id: null },
    { status: 401, headers: { "WWW-Authenticate": 'Bearer realm="julius-clone-mcp"' } },
  );
}

export async function POST(req: Request): Promise<Response> {
  if (!mcpAuthOk(req.headers.get("authorization"), mcpAuthConfigFromEnv())) return unauthorized();

  const limited = await rateLimited(req);
  if (limited) return limited;

  try {
    getAnalytics().capture("mcp_request");
    // No LLM bridge here: `llm_pull_request` blocks waiting for work, which a
    // serverless function can only burn its wall clock on. An MCP host that
    // wants to BE the model runs the stdio server against the same core.
    return await handleMcpHttpRequest(req, { service: getService(), repos: repositories() });
  } catch (err) {
    getAnalytics().captureError(err, { route: "mcp" });
    return Response.json(
      { jsonrpc: "2.0", error: { code: -32603, message: "Internal server error" }, id: null },
      { status: 500 },
    );
  }
}
