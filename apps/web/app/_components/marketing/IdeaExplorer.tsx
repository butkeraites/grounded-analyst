"use client";

import { useState } from "react";

const box = "rounded-md";

function BuildingBlock({ c }: { c: string }) {
  return (
    <svg viewBox="0 0 240 130" className="h-full w-full">
      <g stroke={c} strokeWidth="1.2" opacity="0.5">
        <line x1="120" y1="65" x2="120" y2="24" />
        <line x1="120" y1="65" x2="40" y2="104" />
        <line x1="120" y1="65" x2="200" y2="104" />
      </g>
      <rect x="90" y="50" width="60" height="30" rx="8" fill={`${c}22`} stroke={c} />
      <text x="120" y="69" textAnchor="middle" fontSize="11" fill="#eef2fb">analyst</text>
      {[
        { x: 96, y: 6, w: 48, t: "agent" },
        { x: 8, y: 96, w: 44, t: "chat" },
        { x: 172, y: 96, w: 44, t: "API" },
      ].map((n) => (
        <g key={n.t}>
          <rect x={n.x} y={n.y} width={n.w} height="22" rx="6" fill="#111a2c" stroke="#21304b" />
          <text x={n.x + n.w / 2} y={n.y + 15} textAnchor="middle" fontSize="10" fill="#b3c0d8">{n.t}</text>
        </g>
      ))}
    </svg>
  );
}

function Trust({ c }: { c: string }) {
  return (
    <svg viewBox="0 0 240 130" className="h-full w-full">
      <rect x="14" y="40" width="86" height="50" rx="8" fill="#111a2c" stroke="#21304b" />
      <text x="57" y="60" textAnchor="middle" fontSize="9" fill="#808faa">code output</text>
      <text x="57" y="78" textAnchor="middle" fontSize="14" fill="#eef2fb" fontWeight="600">26,990</text>
      <line x1="104" y1="65" x2="132" y2="65" stroke={c} strokeWidth="1.5" />
      <path d="M132 60 L140 65 L132 70" fill="none" stroke={c} strokeWidth="1.5" />
      <rect x="142" y="40" width="86" height="50" rx="8" fill={`${c}18`} stroke={c} />
      <text x="185" y="60" textAnchor="middle" fontSize="9" fill="#808faa">answer</text>
      <text x="185" y="78" textAnchor="middle" fontSize="13" fill="#eef2fb">$26,990 ✓</text>
    </svg>
  );
}

function Fabric({ c }: { c: string }) {
  return (
    <svg viewBox="0 0 240 130" className="h-full w-full">
      <g fill="#111a2c" stroke="#21304b">
        <rect x="10" y="20" width="34" height="26" rx="4" />
        <rect x="10" y="52" width="34" height="26" rx="4" />
        <path d="M12 92h34v14a17 6 0 0 1-34 0Z" />
        <ellipse cx="29" cy="92" rx="17" ry="6" />
      </g>
      <g stroke={c} strokeWidth="1.2" opacity="0.6">
        <line x1="46" y1="33" x2="150" y2="62" />
        <line x1="46" y1="65" x2="150" y2="65" />
        <line x1="46" y1="98" x2="150" y2="68" />
      </g>
      <rect x="150" y="48" width="80" height="34" rx="8" fill={`${c}18`} stroke={c} />
      <text x="190" y="69" textAnchor="middle" fontSize="10" fill="#eef2fb">one analysis</text>
      <text x="27" y="15" textAnchor="middle" fontSize="9" fill="#808faa">files · DB</text>
    </svg>
  );
}

function Economics({ c }: { c: string }) {
  return (
    <svg viewBox="0 0 240 130" className="h-full w-full">
      <text x="20" y="44" fontSize="10" fill="#808faa">per analysis</text>
      <rect x="20" y="52" width="200" height="14" rx="7" fill="#111a2c" stroke="#21304b" />
      <rect x="20" y="52" width="120" height="14" rx="7" fill={c} opacity="0.8" />
      <text x="24" y="86" fontSize="10" fill="#b3c0d8">tokens · time</text>
      <text x="216" y="86" fontSize="12" fill="#eef2fb" textAnchor="end" fontWeight="600">$ / run</text>
    </svg>
  );
}

const IDEAS = [
  {
    key: "block",
    label: "Building block",
    accent: "#5b9bff",
    text: "Let other systems and agents drive the analyst directly — so it becomes a component inside a customer's own workflows, not only a place they visit.",
    business: "Expansion & stickiness — infrastructure, not just a destination.",
    Diagram: BuildingBlock,
  },
  {
    key: "trust",
    label: "Measurable trust",
    accent: "#ff4757",
    text: "Every answer grounded only in what the code executed, with the code one click away — and evaluation as a visible score you can watch over time.",
    business: "The enterprise buying criterion — a wedge against black boxes.",
    Diagram: Trust,
  },
  {
    key: "fabric",
    label: "Data fabric",
    accent: "#34e0c0",
    text: "Questions that span many files, warehouse connectors, and analyses that re-run on a schedule instead of one-off.",
    business: "From a quick answer to the weekly operating rhythm — retention.",
    Diagram: Fabric,
  },
  {
    key: "econ",
    label: "Unit economics",
    accent: "#ff8a4c",
    text: "Make the cost and time of each analysis legible, so pricing and free-tier reach are decisions, not surprises.",
    business: "Margin — and how far a free tier can stretch as a growth lever.",
    Diagram: Economics,
  },
] as const;

export function IdeaExplorer() {
  const [active, setActive] = useState(0);
  const idea = IDEAS[active]!;
  const Diagram = idea.Diagram;

  return (
    <div>
      <div className="flex flex-wrap justify-center gap-2">
        {IDEAS.map((it, i) => (
          <button
            key={it.key}
            onClick={() => setActive(i)}
            className={`rounded-full border px-4 py-1.5 text-sm transition ${
              i === active ? "text-white" : "border-line text-ink/60 hover:text-ink"
            }`}
            style={i === active ? { background: it.accent, borderColor: it.accent } : undefined}
          >
            {it.label}
          </button>
        ))}
      </div>

      <div className="mt-5 grid items-center gap-6 rounded-2xl border border-line bg-surface/50 p-6 sm:grid-cols-2">
        <div key={`d${active}`} className="fade-up h-36 w-full">
          <Diagram c={idea.accent} />
        </div>
        <div key={`t${active}`} className={`fade-up ${box}`}>
          <p className="text-base leading-relaxed text-ink/90">{idea.text}</p>
          <p className="mt-3 text-xs font-medium" style={{ color: idea.accent }}>
            {idea.business}
          </p>
        </div>
      </div>
    </div>
  );
}
