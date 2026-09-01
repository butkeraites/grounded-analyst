import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { createJuliusMcpServer, type JuliusMcpDeps } from "./index";

/**
 * Serve one MCP request over Streamable HTTP, using Web-standard Request and
 * Response — which is what a Next.js Route Handler (and any edge-ish runtime)
 * speaks. Keeping this here rather than in the route means the transport
 * decisions below are testable without booting Next, and that the two entry
 * points stay symmetric: each one wires a transport to the shared tool surface
 * and owns nothing else.
 *
 * Stateless by construction. Vercel gives no sticky routing, so a session held
 * in one function instance's memory would vanish on the next request; the SDK
 * likewise requires a fresh server + transport per request when
 * `sessionIdGenerator` is undefined. The cost is one initialize round-trip per
 * call, which for stateless tools buys back more than session storage would.
 */
export async function handleMcpHttpRequest(request: Request, deps: JuliusMcpDeps): Promise<Response> {
  // POST only. The spec's GET (server→client stream) and DELETE (session
  // teardown) exist for stateful servers; here the transport would answer GET
  // with an SSE stream that can never carry anything, leaving a client waiting
  // on a socket for a notification this surface never sends. Say 405 instead.
  if (request.method !== "POST") {
    return Response.json(
      {
        jsonrpc: "2.0",
        error: { code: -32000, message: "Method not allowed: this endpoint is stateless (POST only)." },
        id: null,
      },
      { status: 405, headers: { Allow: "POST" } },
    );
  }

  const server = createJuliusMcpServer(deps);
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    // Resolve each POST as a single JSON body instead of holding an SSE stream
    // open: this surface pushes no server-initiated notifications, and a
    // short-lived response is what a serverless function can actually honour.
    enableJsonResponse: true,
  });

  try {
    await server.connect(transport);
    // JSON-response mode materialises the whole body before resolving, so it is
    // safe to tear the server down in `finally`.
    return await transport.handleRequest(request);
  } finally {
    await server.close().catch(() => {});
  }
}
