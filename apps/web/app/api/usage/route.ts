import { NextResponse } from "next/server";
import { repositories } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// $ per 1M tokens; default 0 (free-tier Groq). Set to a real provider's price to
// see cost accrue — the mechanism is the point (unit economics per analysis).
const COST_PER_MTOKEN = Number(process.env.LLM_COST_PER_MTOKEN ?? 0);

export async function GET() {
  const s = await repositories().runs.usageStats();
  const totalTokens = s.promptTokens + s.completionTokens;
  return NextResponse.json({
    analyses: s.analyses,
    successes: s.successes,
    successRate: s.analyses ? s.successes / s.analyses : 0,
    avgDurationMs: s.avgDurationMs,
    promptTokens: s.promptTokens,
    completionTokens: s.completionTokens,
    totalTokens,
    estCostUSD: (totalTokens / 1_000_000) * COST_PER_MTOKEN,
  });
}
