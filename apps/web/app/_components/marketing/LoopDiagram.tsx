function Node({
  label,
  sub,
  icon,
  glow,
}: {
  label: string;
  sub: string;
  icon: React.ReactNode;
  glow?: boolean;
}) {
  return (
    <div
      className={`flex min-w-[8.5rem] flex-1 flex-col items-center gap-2 rounded-2xl border bg-surface/70 px-4 py-5 text-center ${
        glow ? "border-brand/40 pulse-glow" : "border-line"
      }`}
    >
      <span className={glow ? "text-brand" : "text-ink/50"}>{icon}</span>
      <span className="text-sm font-semibold">{label}</span>
      <span className="text-xs text-ink/50">{sub}</span>
    </div>
  );
}

function Arrow() {
  return (
    <svg width="40" height="16" viewBox="0 0 40 16" className="shrink-0 text-ink/30" aria-hidden="true">
      <line x1="0" y1="8" x2="30" y2="8" stroke="currentColor" strokeWidth="1.5" className="flow-dash" />
      <path d="M30 3 L38 8 L30 13" fill="none" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

export function LoopDiagram() {
  return (
    <div className="rounded-2xl border border-line bg-bg-2/40 p-6">
      <div className="flex flex-wrap items-center justify-center gap-3">
        <Node
          label="Ask"
          sub="plain English"
          icon={
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
              <path d="M21 12a8 8 0 0 1-11.5 7.2L4 20l1-4.5A8 8 0 1 1 21 12Z" />
            </svg>
          }
        />
        <Arrow />
        <Node
          glow
          label="Sandbox"
          sub="real Python, isolated"
          icon={
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
              <rect x="3" y="4" width="18" height="16" rx="3" />
              <path d="M8 10l3 2-3 2M13 14h3" />
            </svg>
          }
        />
        <Arrow />
        <Node
          label="Answer"
          sub="chart · table · code"
          icon={
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
              <path d="M4 20V10M10 20V4M16 20v-8M22 20H2" />
            </svg>
          }
        />
      </div>
      <p className="mt-4 text-center text-xs text-ink/50">
        Grounded in what the code actually ran — <span className="text-ink/80">never a guessed number.</span>
      </p>
    </div>
  );
}
