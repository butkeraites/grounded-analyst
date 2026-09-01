import { NextResponse, type NextRequest } from "next/server";
import { basicAuthOk } from "@/lib/auth";

/**
 * A simple shared-password gate for the public deployment. The app EXECUTES
 * code (E2B) and calls a paid LLM (Groq), so leaving it open invites cost abuse.
 * HTTP Basic Auth keeps it to whoever has the password (share it with reviewers).
 *
 * The gate is inert unless SITE_PASSWORD is set — so local dev is never gated,
 * and it activates only once the env var exists on the deployment.
 */
export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  // The marketing landing (and its static assets) is public; only the app +
  // APIs are gated. A founder reads the pitch freely, then logs in to try it.
  if (pathname === "/" || /\.(png|svg|jpe?g|ico|webp|txt)$/.test(pathname)) {
    return NextResponse.next();
  }

  // The MCP endpoint runs its own gate (see lib/mcp-auth): an MCP host sends a
  // bearer token, which this Basic check would reject before the route ever
  // saw it. Skipping here does NOT open it — the route rejects an unauthorized
  // caller with a JSON-RPC 401, and accepts these same Basic credentials too.
  if (pathname === "/api/mcp") return NextResponse.next();

  const password = process.env.SITE_PASSWORD;
  if (!password) return NextResponse.next();

  const user = process.env.SITE_USER ?? "julius";
  if (basicAuthOk(req.headers.get("authorization"), user, password)) {
    return NextResponse.next();
  }

  // Only real top-level navigations should trigger the browser's native login
  // dialog. Background prefetch/RSC/fetch subrequests (e.g. Next prefetching
  // /app while the visitor is still reading the public landing) get a plain 401
  // with NO WWW-Authenticate header — so the login box never pops unbidden.
  const isDocumentNav =
    req.headers.get("sec-fetch-dest") === "document" &&
    req.headers.get("sec-fetch-mode") === "navigate" &&
    req.headers.get("next-router-prefetch") !== "1" &&
    req.headers.get("sec-purpose") !== "prefetch";

  const headers: Record<string, string> = {};
  if (isDocumentNav) {
    headers["WWW-Authenticate"] = 'Basic realm="Julius clone", charset="UTF-8"';
  }
  return new NextResponse("Authentication required.", { status: 401, headers });
}

// Gate everything except Next's static assets and the favicon.
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
