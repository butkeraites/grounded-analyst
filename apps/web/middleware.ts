import { NextResponse, type NextRequest } from "next/server";

/**
 * A simple shared-password gate for the public deployment. The app EXECUTES
 * code (E2B) and calls a paid LLM (Groq), so leaving it open invites cost abuse.
 * HTTP Basic Auth keeps it to whoever has the password (share it with reviewers).
 *
 * The gate is inert unless SITE_PASSWORD is set — so local dev is never gated,
 * and it activates only once the env var exists on the deployment.
 */
export function middleware(req: NextRequest) {
  const password = process.env.SITE_PASSWORD;
  if (!password) return NextResponse.next();

  const user = process.env.SITE_USER ?? "grounded";
  const header = req.headers.get("authorization");
  if (header?.startsWith("Basic ")) {
    try {
      const [u, p] = atob(header.slice(6)).split(":");
      if (u === user && p === password) return NextResponse.next();
    } catch {
      // fall through to 401
    }
  }
  return new NextResponse("Authentication required.", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="Grounded clone", charset="UTF-8"' },
  });
}

// Gate everything except Next's static assets and the favicon.
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
