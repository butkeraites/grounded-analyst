/**
 * Pure auth/HTTP helpers — kept free of `next/server` so they are unit-testable.
 * Used by the middleware gate and the rate limiter.
 */

/** Validate an HTTP Basic `Authorization` header against a user/password. */
export function basicAuthOk(header: string | null, user: string, password: string): boolean {
  if (!header?.startsWith("Basic ")) return false;
  try {
    const [u, p] = atob(header.slice(6)).split(":");
    return u === user && p === password;
  } catch {
    return false;
  }
}

/** Best-effort client IP from proxy headers (Vercel sets x-forwarded-for). */
export function clientIp(headers: { get(name: string): string | null }): string {
  return (headers.get("x-forwarded-for") ?? "anon").split(",")[0]!.trim() || "anon";
}
