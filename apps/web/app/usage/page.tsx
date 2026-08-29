import Link from "next/link";
import { repositories } from "@/lib/db";

// Server Component: reads live aggregates on each request.
export const dynamic = "force-dynamic";

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-lg border border-ink/10 bg-white px-5 py-4">
      <div className="text-xs uppercase tracking-wide text-ink/40">{label}</div>
      <div className="mt-1 text-2xl font-semibold tabular-nums">{value}</div>
      {sub && <div className="mt-0.5 text-xs text-ink/50">{sub}</div>}
    </div>
  );
}

export default async function UsagePage() {
  const s = await repositories().runs.usageStats();
  const totalTokens = s.promptTokens + s.completionTokens;
  const cost = (totalTokens / 1_000_000) * Number(process.env.LLM_COST_PER_MTOKEN ?? 0);
  const successRate = s.analyses ? Math.round((s.successes / s.analyses) * 100) : 0;

  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <Link href="/" className="text-sm text-ink/50 hover:text-ink">
        ← back
      </Link>
      <h1 className="mt-6 text-2xl font-semibold tracking-tight">Usage &amp; cost</h1>
      <p className="mt-2 text-sm text-ink/60">
        Live aggregates over every analysis run — the unit economics of the platform.
      </p>

      <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Stat label="Analyses" value={s.analyses.toLocaleString()} />
        <Stat label="Success rate" value={`${successRate}%`} sub={`${s.successes}/${s.analyses}`} />
        <Stat label="Avg duration" value={`${(s.avgDurationMs / 1000).toFixed(1)}s`} />
        <Stat label="Prompt tokens" value={s.promptTokens.toLocaleString()} />
        <Stat label="Completion tokens" value={s.completionTokens.toLocaleString()} />
        <Stat label="Est. cost" value={`$${cost.toFixed(4)}`} sub="free tier · $0" />
      </div>
    </main>
  );
}
