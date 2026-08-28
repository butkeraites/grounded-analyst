import { NextResponse } from "next/server";
import { pingDb } from "@/lib/db";
import { pingRedis } from "@/lib/redis";

// Long-running Node server locally; never statically optimized.
export const dynamic = "force-dynamic";

type Status = "ok" | "error";

async function probe(fn: () => Promise<void>): Promise<Status> {
  try {
    await fn();
    return "ok";
  } catch (err) {
    console.error("[health] probe failed:", err);
    return "error";
  }
}

/** Real liveness check: pings Postgres and Redis, reports each independently. */
export async function GET() {
  const [db, redis] = await Promise.all([probe(pingDb), probe(pingRedis)]);
  const ok = db === "ok" && redis === "ok";
  return NextResponse.json({ status: ok ? "ok" : "degraded", db, redis }, { status: ok ? 200 : 503 });
}
