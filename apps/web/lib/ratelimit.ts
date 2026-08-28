import { NextResponse } from "next/server";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

/**
 * Per-IP rate limiting for the expensive endpoints (each analysis spins up an
 * E2B sandbox and calls a paid LLM). Backed by Upstash REST, which fits
 * serverless. Inert unless UPSTASH_REDIS_REST_URL/TOKEN are set — so it never
 * breaks local dev or an un-provisioned deploy, and activates once configured.
 */

let cached: Ratelimit | null | undefined;

function limiter(): Ratelimit | null {
  if (cached !== undefined) return cached;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  cached =
    url && token
      ? new Ratelimit({
          redis: new Redis({ url, token }),
          // 20 requests per minute per IP across the compute endpoints.
          limiter: Ratelimit.slidingWindow(20, "60 s"),
          prefix: "julius:rl",
          analytics: false,
        })
      : null;
  return cached;
}

function clientIp(req: Request): string {
  return (req.headers.get("x-forwarded-for") ?? "anon").split(",")[0]!.trim() || "anon";
}

/**
 * Returns a 429 response if the caller is over the limit, else null (proceed).
 * Fails open on limiter errors — availability over strictness for a demo.
 */
export async function rateLimited(req: Request): Promise<NextResponse | null> {
  const rl = limiter();
  if (!rl) return null;
  try {
    const { success, reset } = await rl.limit(clientIp(req));
    if (success) return null;
    const retryAfter = Math.max(1, Math.ceil((reset - Date.now()) / 1000));
    return NextResponse.json(
      { error: "Too many requests — please slow down." },
      { status: 429, headers: { "Retry-After": String(retryAfter) } },
    );
  } catch {
    return null;
  }
}
