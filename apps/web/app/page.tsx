import Link from "next/link";
import { Logo, LogoMark } from "./_components/brand/Logo";

const REPO = "https://github.com/butkeraites/grounded-analyst";
const ARCHITECTURE = `${REPO}/blob/main/docs/ARCHITECTURE.md`;

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-block text-xs font-bold uppercase tracking-[0.18em] text-brand">{children}</span>
  );
}

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full border border-line bg-surface/60 px-3 py-1 text-xs text-ink/70">{children}</span>
  );
}

function Feature({
  n,
  title,
  children,
  accent,
}: {
  n: string;
  title: string;
  children: React.ReactNode;
  accent: string;
}) {
  return (
    <div className="rounded-2xl border border-line bg-surface/60 p-6">
      <div className="mb-3 flex items-center gap-3">
        <span className="grid h-7 w-7 place-items-center rounded-lg text-xs font-bold" style={{ background: `${accent}1f`, color: accent }}>
          {n}
        </span>
        <h3 className="text-lg font-semibold tracking-tight">{title}</h3>
      </div>
      <p className="text-sm leading-relaxed text-ink/70">{children}</p>
    </div>
  );
}

export default function Landing() {
  return (
    <div className="min-h-screen">
      {/* Nav */}
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <Logo height={24} sub />
        <nav className="flex items-center gap-5 text-sm text-ink/70">
          <a href={ARCHITECTURE} className="hidden hover:text-ink sm:inline">Architecture</a>
          <a href={REPO} className="hidden hover:text-ink sm:inline">GitHub</a>
          <Link href="/app" className="rounded-lg bg-accent px-4 py-2 font-medium text-white">
            Launch the app →
          </Link>
        </nav>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-3xl px-6 pb-10 pt-16 text-center sm:pt-24">
        <Eyebrow>The CTO audition</Eyebrow>
        <h1 className="mt-4 text-4xl font-semibold leading-[1.08] tracking-tight sm:text-6xl">
          The AI data analyst, rebuilt on <span className="grad-brand">your stack</span> — and taken further.
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-ink/70">
          Grounded&apos;s core, in production: upload a dataset, ask in plain English, and get back a chart, a
          table, and a written answer — from <strong className="text-ink">real Python executed in an isolated
          sandbox</strong>, never a number the model guessed. Built on the exact stack you hire for. Then the
          parts a CTO adds.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link href="/app" className="rounded-lg bg-accent px-5 py-2.5 text-sm font-medium text-white">
            Launch the live app →
          </Link>
          <a href={ARCHITECTURE} className="rounded-lg border border-line px-5 py-2.5 text-sm font-medium text-ink/80 hover:border-ink/30">
            Read the architecture
          </a>
        </div>
        <div className="mt-8 flex flex-wrap justify-center gap-2">
          {["Next.js", "React", "TypeScript", "Tailwind", "Postgres", "Vercel", "Redis", "PostHog"].map((t) => (
            <Pill key={t}>{t}</Pill>
          ))}
        </div>
      </section>

      {/* Pitch */}
      <section className="mx-auto max-w-3xl px-6 py-10">
        <div className="rounded-2xl border border-brand/20 bg-brand/[0.06] p-6 text-center">
          <p className="text-lg leading-relaxed text-ink/90">
            You&apos;re a CEO who needs a CTO. This isn&apos;t a deck about one — it&apos;s the product.
            I rebuilt the core of your platform on your own stack, shipped it live, and engineered it the way
            I&apos;d run your engineering: measured, secured, and observable.
          </p>
        </div>
      </section>

      {/* Features */}
      <section className="mx-auto max-w-5xl px-6 py-6">
        <div className="mb-6 text-center">
          <Eyebrow>What&apos;s under the hood</Eyebrow>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">Not a wrapper. Engineering.</h2>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <Feature n="1" title="Your exact stack" accent="#5b9bff">
            Next.js · React · TypeScript · Tailwind · Postgres · Vercel · Redis · PostHog. Not a prototype in a
            different toolchain — the one you already hire for, deployed and running.
          </Feature>
          <Feature n="2" title="The hard part, solved" accent="#ff4757">
            Untrusted, LLM-generated Python runs in an ephemeral sandbox — no network, read-only, resource-capped,
            torn down per run. And it never fabricates: the answer is grounded only in what the code executed.
          </Feature>
          <Feature n="3" title="The part Grounded doesn't ship" accent="#34e0c0">
            An MCP server exposes the whole platform, so any agent can pilot it — upload, ask, and pull back the
            chart, table, and the generated code. Grounded is an MCP client with no public API; this fills that gap.
          </Feature>
          <Feature n="4" title="Measured, not vibes" accent="#ff8a4c">
            An eval harness scores execution-based correctness and grounding faithfulness over a golden set, gated
            in CI on every pull request. Quality is a number that can&apos;t regress silently.
          </Feature>
          <Feature n="5" title="It runs itself" accent="#5b9bff">
            Structured logging, per-analysis cost accounting, per-IP rate limiting, an auth gate, and a live
            usage dashboard. The operational machinery that lets a CTO stop babysitting.
          </Feature>
          <Feature n="6" title="Streamed &amp; auditable" accent="#2fd39a">
            Answers stream token-by-token; every run keeps its code, output, and tokens as an audit trail. Click
            &quot;show code&quot; on any answer — transparency by default.
          </Feature>
        </div>
      </section>

      {/* Close */}
      <section className="mx-auto max-w-3xl px-6 py-16 text-center">
        <div className="mb-4 flex justify-center">
          <LogoMark size={44} />
        </div>
        <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          You need a CTO who ships. This is the audition.
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-ink/70">
          Everything here — the sandbox, the MCP server, the eval harness, the CI, the deploy — is one engineer,
          part-time. Imagine it pointed at your roadmap.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link href="/app" className="rounded-lg bg-accent px-5 py-2.5 text-sm font-medium text-white">
            Try the live app →
          </Link>
          <a href="mailto:rbritobut@gmail.com" className="rounded-lg border border-line px-5 py-2.5 text-sm font-medium text-ink/80 hover:border-ink/30">
            Talk to me
          </a>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-6 py-8 text-sm text-ink/50 sm:flex-row">
          <Logo height={20} />
          <p className="text-ink/40">Science, not model wrappers.</p>
          <div className="flex gap-4">
            <a href={REPO} className="hover:text-ink">GitHub</a>
            <a href={ARCHITECTURE} className="hover:text-ink">Architecture</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
