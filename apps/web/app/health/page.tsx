import Link from "next/link";
import { pingDb } from "@/lib/db";
import { pingRedis } from "@/lib/redis";

// Server Component: probes run on the server on each request.
export const dynamic = "force-dynamic";

async function check(fn: () => Promise<void>): Promise<boolean> {
  try {
    await fn();
    return true;
  } catch {
    return false;
  }
}

function Row({ label, up }: { label: string; up: boolean }) {
  return (
    <li className="flex items-center justify-between border-b border-ink/10 py-4 last:border-0">
      <span className="font-medium">{label}</span>
      <span
        className={`inline-flex items-center gap-2 text-sm ${up ? "text-emerald-700" : "text-red-700"}`}
      >
        <span
          aria-hidden
          className={`h-2 w-2 rounded-full ${up ? "bg-emerald-500" : "bg-red-500"}`}
        />
        {up ? "up" : "down"}
      </span>
    </li>
  );
}

export default async function HealthPage() {
  const [db, redis] = await Promise.all([check(pingDb), check(pingRedis)]);
  const web = true; // if this rendered, the web tier is up.

  return (
    <main className="mx-auto max-w-md px-6 py-20">
      <Link href="/" className="text-sm text-ink/50 hover:text-ink">
        ← back
      </Link>
      <h1 className="mt-6 text-2xl font-semibold tracking-tight">System health</h1>
      <p className="mt-2 text-sm text-ink/60">
        Live probe of the three local containers — the proof the pipe is wired
        end-to-end.
      </p>
      <ul className="mt-8 rounded-lg border border-ink/10 bg-surface px-5">
        <Row label="Web (Next.js)" up={web} />
        <Row label="Postgres" up={db} />
        <Row label="Redis" up={redis} />
      </ul>
    </main>
  );
}
