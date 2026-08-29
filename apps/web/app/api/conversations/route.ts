import { NextResponse } from "next/server";
import { repositories } from "@/lib/db";
import { rateLimited } from "@/lib/ratelimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

/** List conversations for the history sidebar, titled by their first question. */
export async function GET(req: Request) {
  const limited = await rateLimited(req);
  if (limited) return limited;

  // Single query (no N+1) — safe under Neon's serverless connection limits.
  const rows = await repositories().conversations.listSummaries(50);
  const conversations = rows
    .filter((r) => r.title)
    .map((r) => ({ id: r.id, datasetId: r.datasetId, title: r.title, createdAt: r.createdAt }));
  return NextResponse.json({ conversations });
}
