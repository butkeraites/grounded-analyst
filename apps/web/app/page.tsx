import Link from "next/link";
import { Logo, LogoMark } from "./_components/brand/Logo";

const REPO = "https://github.com/butkeraites/julius-clone";
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

function Idea({
  title,
  business,
  children,
  accent,
}: {
  title: string;
  business: string;
  children: React.ReactNode;
  accent: string;
}) {
  return (
    <div className="rounded-2xl border border-line bg-surface/60 p-6">
      <h3 className="text-lg font-semibold tracking-tight">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-ink/70">{children}</p>
      <p className="mt-3 text-xs leading-relaxed" style={{ color: accent }}>
        <span className="font-semibold uppercase tracking-wide">Why it could matter · </span>
        {business}
      </p>
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
          <a href={ARCHITECTURE} className="hidden hover:text-ink sm:inline">Notes</a>
          <a href={REPO} className="hidden hover:text-ink sm:inline">Code</a>
          <Link href="/app" className="rounded-lg border border-line px-4 py-2 font-medium text-ink/80 hover:border-ink/30">
            Open the exploration →
          </Link>
        </nav>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-3xl px-6 pb-8 pt-16 text-center sm:pt-24">
        <Eyebrow>An outside-in product perspective</Eyebrow>
        <h1 className="mt-4 text-4xl font-semibold leading-[1.1] tracking-tight sm:text-5xl">
          Some thoughts on where the <span className="grad-brand">AI data analyst</span> could go next.
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-ink/70">
          I find this product category genuinely exciting, so — rather than theorise from the outside — I built a
          small working exploration to think in code instead of slides. It does the core loop (ask a question,
          run real Python over the data, get a grounded answer back) and let me prototype a few ideas about the
          road ahead. What follows is a point of view, offered as a conversation — not a claim to have understood
          it from the inside.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link href="/app" className="rounded-lg bg-accent px-5 py-2.5 text-sm font-medium text-white">
            See the exploration →
          </Link>
          <a href={ARCHITECTURE} className="rounded-lg border border-line px-5 py-2.5 text-sm font-medium text-ink/80 hover:border-ink/30">
            Read the build notes
          </a>
        </div>
      </section>

      {/* The category / positioning */}
      <section className="mx-auto max-w-3xl px-6 py-10">
        <Eyebrow>The lay of the land</Eyebrow>
        <h2 className="mt-2 text-2xl font-semibold tracking-tight">A strong core, in a category that&apos;s filling up</h2>
        <p className="mt-4 text-ink/70">
          The &quot;ask your data in plain English and get real analysis back&quot; loop has quietly become one of the
          most useful applied-AI products around, and the teams that got it right earned real trust. From the
          outside, the interesting question no longer looks like the loop itself — it looks like what compounds
          around it as more players (notebooks-with-AI, general assistants, BI incumbents) crowd in. Where does
          the durable advantage sit? A few directions stood out while I was building; I could easily be wrong
          about which are already underway.
        </p>
      </section>

      {/* Ideas */}
      <section className="mx-auto max-w-5xl px-6 py-4">
        <div className="grid gap-4 md:grid-cols-2">
          <Idea
            title="The analyst as a building block, not just a chat"
            accent="#5b9bff"
            business="Turns a destination product into infrastructure others build on — a path to expansion revenue and stickiness that point tools can't easily match."
          >
            Today the value is a person in a chat window. A natural next step is letting other systems and agents
            drive the analyst directly — a clean API or agent-facing surface — so it becomes a component inside a
            customer&apos;s own workflows. In the exploration I tried this as an MCP server: an external agent can
            upload, ask, and pull back the chart, table, and the generated code.
          </Idea>
          <Idea
            title="Trust you can point to, not just claim"
            accent="#ff4757"
            business="As answers feed real decisions, 'can I trust this number?' becomes the buying criterion — and a measurable answer is a wedge against black-box competitors, especially in the enterprise."
          >
            The moment analysis informs a decision, faithfulness matters more than fluency. Two things I explored:
            grounding every answer strictly in what the code actually executed (never a guessed number, with the
            code one click away), and treating <em>evaluation</em> as a first-class surface — scoring correctness
            and grounding so quality is a number that can be watched over time.
          </Idea>
          <Idea
            title="From a single file to a data fabric"
            accent="#34e0c0"
            business="Moves usage from 'one quick answer' to 'runs my recurring analysis' — which is where retention and larger accounts tend to live."
          >
            A lot of real questions span more than one table, or need the same analysis re-run on a schedule.
            Multi-file joins, warehouse/DB connectors, and reproducible or scheduled runs seem like a natural arc
            from ad-hoc answers toward being part of the weekly operating rhythm.
          </Idea>
          <Idea
            title="Unit economics as the product scales"
            accent="#ff8a4c"
            business="Cost-per-analysis and speed shape margin — and a healthy margin is what makes a generous free tier a growth lever rather than a liability."
          >
            Every analysis carries a real cost (execution + model). Making that legible — tokens and time per run,
            visible as a small dashboard — felt worth doing even in a sketch, because it&apos;s the kind of thing
            that quietly decides pricing and how far a free tier can reach.
          </Idea>
        </div>
      </section>

      {/* The exploration, kept modest */}
      <section className="mx-auto max-w-3xl px-6 py-14">
        <div className="rounded-2xl border border-line bg-surface/50 p-7">
          <div className="mb-3 flex items-center gap-3">
            <LogoMark size={34} />
            <h2 className="text-xl font-semibold tracking-tight">About the exploration</h2>
          </div>
          <p className="text-ink/70">
            It&apos;s a small, honest prototype — a way to test these ideas in working code rather than argue them
            in the abstract. It runs the core loop end-to-end: upload a CSV, ask in plain English, and get a
            streamed answer built from real Python executed in an isolated sandbox, with the chart, table, and
            code shown. On top of that it sketches the agent-drivable surface and the evaluation idea above. It&apos;s
            deliberately narrow and far from a product — think of it as notes you can click through.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {["Next.js", "React", "TypeScript", "Tailwind", "Postgres", "Vercel", "Redis"].map((t) => (
              <Pill key={t}>{t}</Pill>
            ))}
          </div>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/app" className="rounded-lg bg-accent px-5 py-2.5 text-sm font-medium text-white">
              Open the exploration →
            </Link>
            <a href={ARCHITECTURE} className="rounded-lg border border-line px-5 py-2.5 text-sm font-medium text-ink/80 hover:border-ink/30">
              How it&apos;s built
            </a>
          </div>
        </div>
      </section>

      {/* Close — an invitation, not a pitch */}
      <section className="mx-auto max-w-2xl px-6 pb-16 text-center">
        <h2 className="text-2xl font-semibold tracking-tight">An open invitation</h2>
        <p className="mt-4 text-ink/70">
          These are an outsider&apos;s guesses, formed from what I could see from here — some may already be on
          your roadmap, some I may have read wrong. If any of it resonates, or if you&apos;d enjoy poking holes in
          it, I&apos;d genuinely like to compare notes.
        </p>
        <div className="mt-7">
          <a href="mailto:rbritobut@gmail.com" className="rounded-lg border border-line px-5 py-2.5 text-sm font-medium text-ink/80 hover:border-ink/30">
            Compare notes →
          </a>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-6 py-8 text-sm text-ink/50 sm:flex-row">
          <Logo height={20} />
          <p className="text-ink/40">Science, not model wrappers.</p>
          <div className="flex gap-4">
            <a href={REPO} className="hover:text-ink">Code</a>
            <a href={ARCHITECTURE} className="hover:text-ink">Notes</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
