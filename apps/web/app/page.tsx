import Link from "next/link";
import { Logo, LogoMark } from "./_components/brand/Logo";
import { LoopDiagram } from "./_components/marketing/LoopDiagram";
import { IdeaExplorer } from "./_components/marketing/IdeaExplorer";
import { StackDiagram } from "./_components/marketing/StackDiagram";
import { CompareNotes } from "./_components/marketing/CompareNotes";
import { EvolutionMap } from "./_components/marketing/EvolutionMap";

const REPO = "https://github.com/butkeraites/julius-clone";
const ARCHITECTURE = `${REPO}/blob/main/docs/ARCHITECTURE.md`;

function Eyebrow({ children }: { children: React.ReactNode }) {
  return <span className="text-xs font-bold uppercase tracking-[0.18em] text-brand">{children}</span>;
}

export default function Landing() {
  return (
    <div className="min-h-screen">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <Logo height={24} sub />
        <nav className="flex items-center gap-5 text-sm text-ink/70">
          <a href={ARCHITECTURE} className="hidden hover:text-ink sm:inline">Notes</a>
          <a href={REPO} className="hidden hover:text-ink sm:inline">Code</a>
          <Link href="/app" prefetch={false} className="rounded-lg border border-line px-4 py-2 font-medium text-ink/80 hover:border-ink/30">
            Open the exploration →
          </Link>
        </nav>
      </header>

      {/* Hero — tight */}
      <section className="mx-auto max-w-3xl px-6 pb-6 pt-14 text-center sm:pt-20">
        <Eyebrow>An outside-in product perspective</Eyebrow>
        <h1 className="mt-4 text-4xl font-semibold leading-[1.1] tracking-tight sm:text-5xl">
          Where could the <span className="grad-brand">AI data analyst</span> go next?
        </h1>
        <p className="mx-auto mt-5 max-w-xl text-lg text-ink/70">
          A few ideas — explored in working code, not slides. A point of view, offered as a conversation.
        </p>
        <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
          <Link href="/app" prefetch={false} className="rounded-lg bg-accent px-5 py-2.5 text-sm font-medium text-white">
            See the exploration →
          </Link>
          <a href={ARCHITECTURE} className="rounded-lg border border-line px-5 py-2.5 text-sm font-medium text-ink/80 hover:border-ink/30">
            Build notes
          </a>
        </div>
      </section>

      {/* The loop — diagram, almost no text */}
      <section className="mx-auto max-w-2xl px-6 py-8">
        <LoopDiagram />
      </section>

      {/* The architecture — interactive stack diagram */}
      <section className="mx-auto max-w-3xl px-6 pb-2 pt-10 text-center">
        <Eyebrow>Built with your stack</Eyebrow>
        <h2 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">The architecture, one tap at a time</h2>
      </section>
      <section className="mx-auto max-w-3xl px-6 py-6">
        <StackDiagram />
      </section>

      {/* Positioning — one line */}
      <section className="mx-auto max-w-2xl px-6 pb-2 pt-8 text-center">
        <Eyebrow>The road ahead</Eyebrow>
        <p className="mt-3 text-ink/70">
          The core loop is solved. As the category fills up, the advantage compounds around it — here&apos;s where
          I&apos;d look. <span className="text-ink/40">Tap through.</span>
        </p>
      </section>

      {/* Interactive ideas */}
      <section className="mx-auto max-w-4xl px-6 py-6">
        <IdeaExplorer />
      </section>

      {/* Given more time — the bold, natural evolution */}
      <section className="mx-auto max-w-3xl px-6 pb-2 pt-12 text-center">
        <Eyebrow>Given more time</Eyebrow>
        <h2 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
          Where this platform naturally goes
        </h2>
        <p className="mx-auto mt-3 max-w-lg text-ink/60">
          The loop is the seed. Everything below grows toward one thing.
        </p>
      </section>
      <section className="mx-auto max-w-3xl px-6 py-6">
        <EvolutionMap />
      </section>

      {/* Exploration — compact */}
      <section className="mx-auto max-w-2xl px-6 py-14">
        <div className="flex flex-col items-center gap-4 rounded-2xl border border-line bg-surface/50 p-7 text-center">
          <LogoMark size={34} />
          <p className="text-ink/70">
            A small, honest prototype to test these ideas in working code — the loop end-to-end, plus sketches of
            the agent surface and the eval. Narrow by design; think of it as notes you can click through.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <Link href="/app" prefetch={false} className="rounded-lg bg-accent px-5 py-2.5 text-sm font-medium text-white">
              Open the exploration →
            </Link>
            <a href={ARCHITECTURE} className="rounded-lg border border-line px-5 py-2.5 text-sm font-medium text-ink/80 hover:border-ink/30">
              How it&apos;s built
            </a>
          </div>
        </div>
      </section>

      {/* Close */}
      <section className="mx-auto max-w-xl px-6 pb-16 text-center">
        <h2 className="text-2xl font-semibold tracking-tight">An open invitation</h2>
        <p className="mt-3 text-ink/70">
          Outsider&apos;s guesses — some may already be on your roadmap, some I may have read wrong. I&apos;d
          enjoy comparing notes.
        </p>
        <CompareNotes />
      </section>

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
