"use client";

import { useState } from "react";

type IconName =
  | "brain"
  | "database"
  | "stream"
  | "layers"
  | "cloud"
  | "chat"
  | "radar"
  | "lens";

function Icon({ name, size = 20 }: { name: IconName; size?: number }) {
  const p = { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.6, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  switch (name) {
    case "brain":
      return (<svg {...p}><path d="M12 5a3 3 0 0 0-6 0 3 3 0 0 0-2 5 3 3 0 0 0 2 5 3 3 0 0 0 6 0Z" /><path d="M12 5a3 3 0 0 1 6 0 3 3 0 0 1 2 5 3 3 0 0 1-2 5 3 3 0 0 1-6 0" /></svg>);
    case "database":
      return (<svg {...p}><ellipse cx="12" cy="5" rx="8" ry="3" /><path d="M4 5v6c0 1.7 3.6 3 8 3s8-1.3 8-3V5M4 11v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6" /></svg>);
    case "stream":
      return (<svg {...p}><path d="M3 8c3 0 3-3 6-3s3 3 6 3 3-3 6-3M3 16c3 0 3-3 6-3s3 3 6 3 3-3 6-3" /></svg>);
    case "layers":
      return (<svg {...p}><path d="M12 3 3 8l9 5 9-5-9-5ZM4 12l8 4 8-4M4 16l8 4 8-4" /></svg>);
    case "cloud":
      return (<svg {...p}><path d="M7 18a4 4 0 0 1-.5-8A5 5 0 0 1 16 8.5a3.5 3.5 0 0 1 1 6.9" /><path d="M12 13v6M9.5 16l2.5 3 2.5-3" /></svg>);
    case "chat":
      return (<svg {...p}><path d="M4 5h11a3 3 0 0 1 3 3v3a3 3 0 0 1-3 3H9l-4 3v-3a3 3 0 0 1-1-2V8a3 3 0 0 1 3-3Z" /><path d="M20 9v5a3 3 0 0 1-3 3" /></svg>);
    case "radar":
      return (<svg {...p}><path d="M12 12 19 5" /><path d="M12 3a9 9 0 1 0 9 9" /><path d="M12 7a5 5 0 1 0 5 5" /></svg>);
    case "lens":
      return (<svg {...p}><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>);
  }
}

interface Move {
  id: string;
  label: string;
  icon: IconName;
  accent: string;
  title: string;
  text: string;
  angle: string;
}

const HUB: Move = {
  id: "brain",
  label: "The company brain",
  icon: "brain",
  accent: "#ff4757",
  title: "The north star — a company brain",
  text: "An intelligence layer over every connected source: ask the organization anything and get an answer grounded in its own live data, not a guess. Every move below is a road toward this.",
  angle: "Not a tool people visit — the way a company reasons about itself.",
};

const MOVES: Move[] = [
  {
    id: "connectors",
    label: "Live data connectors",
    icon: "database",
    accent: "#5b9bff",
    title: "Analyze where the data lives",
    text: "Read straight from the customer's own databases — Postgres, Snowflake, Mongo, DynamoDB — SQL and NoSQL alike, no export step.",
    angle: "Removes the upload wall; meets enterprise data where it already sits.",
  },
  {
    id: "streaming",
    label: "Streaming ingestion",
    icon: "stream",
    accent: "#34e0c0",
    title: "One fabric from many sources",
    text: "Hotglue- and Fivetran-style connectors that continuously pull dozens of SaaS sources into one analyzable fabric.",
    angle: "One question can span the whole business, not one file.",
  },
  {
    id: "tenancy",
    label: "Multi-tenant core",
    icon: "layers",
    accent: "#ff4757",
    title: "The piece a PoC leaves out",
    text: "Real tenancy: isolation, roles, and quotas per organization — the deliberate gap in this prototype, and the line between a demo and a product.",
    angle: "What turns a working slice into something you can sell.",
  },
  {
    id: "aws",
    label: "AWS serverless at scale",
    icon: "cloud",
    accent: "#ff8a4c",
    title: "The sandbox, cloud-native",
    text: "Elastic per-tenant execution on Lambda/Fargate — the same isolated-sandbox pattern, metered and scaled without babysitting servers.",
    angle: "Scales to many tenants; you pay only for the runs.",
  },
  {
    id: "bots",
    label: "Where your users already are",
    icon: "chat",
    accent: "#5b9bff",
    title: "The analyst comes to them",
    text: "MCP-driven bots in Slack, WhatsApp and Telegram — ask your data a question without leaving the conversation you're already in.",
    angle: "Distribution: the analyst reaches users in their own channels.",
  },
  {
    id: "observability",
    label: "Watchable quality",
    icon: "radar",
    accent: "#34e0c0",
    title: "Quality and cost you can see",
    text: "Deeper eval gates, tracing, and drift + cost dashboards — the analyst's accuracy and spend become numbers you watch, not hope for.",
    angle: "The trust signal an enterprise buyer checks for first.",
  },
  {
    id: "stackread",
    label: "A fresh read on the stack",
    icon: "lens",
    accent: "#b3c0d8",
    title: "An outside pair of eyes",
    text: "A careful pass across the stack for consistency and performance wins — offered as collaboration, from someone who just rebuilt the loop end to end.",
    angle: "Small, compounding gains in speed and cost.",
  },
];

const ALL = [HUB, ...MOVES];

export function EvolutionMap() {
  const [activeId, setActiveId] = useState(HUB.id);
  const active = ALL.find((m) => m.id === activeId)!;

  return (
    <div className="rounded-2xl border border-line bg-bg-2/40 p-5 sm:p-7">
      {/* North star */}
      <button
        onClick={() => setActiveId(HUB.id)}
        className={`mx-auto flex w-full max-w-md flex-col items-center gap-2 rounded-2xl border px-6 py-5 text-center transition ${
          activeId === HUB.id ? "border-brand/50 pulse-glow" : "border-line hover:border-ink/25"
        }`}
      >
        <span className="text-brand"><Icon name="brain" size={26} /></span>
        <span className="text-sm font-semibold text-ink">The company brain</span>
        <span className="text-xs text-ink/45">the destination every move below builds toward</span>
      </button>

      <div className="flex justify-center py-2 text-ink/25">
        <svg width="14" height="16" viewBox="0 0 14 16" aria-hidden="true">
          <path d="M7 15V2M3 6l4-4 4 4" fill="none" stroke="currentColor" strokeWidth="1.3" />
        </svg>
      </div>

      {/* Detail panel */}
      <div key={activeId} className="fade-up mb-5 rounded-xl border border-line bg-surface/60 p-5">
        <div className="flex items-center gap-3">
          <span style={{ color: active.accent }}><Icon name={active.icon} size={22} /></span>
          <p className="text-sm font-semibold" style={{ color: active.accent }}>{active.title}</p>
        </div>
        <p className="mt-3 text-sm leading-relaxed text-ink/85">{active.text}</p>
        <p className="mt-2 text-xs font-medium" style={{ color: active.accent }}>{active.angle}</p>
      </div>

      {/* Feeder moves */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {MOVES.map((m) => {
          const on = m.id === activeId;
          return (
            <button
              key={m.id}
              onClick={() => setActiveId(m.id)}
              className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 text-left text-xs transition sm:text-sm ${
                on ? "bg-surface" : "border-line bg-surface/40 text-ink/70 hover:text-ink"
              }`}
              style={on ? { borderColor: m.accent, color: "#eef2fb" } : undefined}
            >
              <span className="shrink-0" style={{ color: on ? m.accent : "#8fa0bd" }}>
                <Icon name={m.icon} size={18} />
              </span>
              <span className="leading-tight">{m.label}</span>
            </button>
          );
        })}
      </div>

      <p className="mt-5 text-center text-xs text-ink/40">
        The natural evolution — tap any move to see where it leads.
      </p>
    </div>
  );
}
