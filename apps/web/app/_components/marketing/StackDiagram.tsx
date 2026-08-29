"use client";

import { useState } from "react";
import {
  siReact,
  siNextdotjs,
  siTypescript,
  siTailwindcss,
  siVercel,
  siPostgresql,
  siRedis,
  siPosthog,
  siDocker,
  siOllama,
} from "simple-icons";
import { LogoMark } from "../brand/Logo";

const SI: Record<string, { path: string }> = {
  react: siReact,
  next: siNextdotjs,
  ts: siTypescript,
  tailwind: siTailwindcss,
  vercel: siVercel,
  postgres: siPostgresql,
  redis: siRedis,
  posthog: siPosthog,
  docker: siDocker,
  ollama: siOllama,
};

function Glyph({ icon, size = 18 }: { icon: string; size?: number }) {
  if (icon === "core") return <LogoMark size={size} />;
  if (icon === "mcp") {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
        <circle cx="7" cy="12" r="3" />
        <circle cx="17" cy="6" r="3" />
        <circle cx="17" cy="18" r="3" />
        <path d="M9.6 10.5 14.5 7M9.6 13.5 14.5 17" />
      </svg>
    );
  }
  const si = SI[icon];
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d={si?.path} />
    </svg>
  );
}

interface Node {
  id: string;
  name: string;
  icon: string;
  accent: string;
  decision: { title: string; text: string };
}

const TIERS: Array<{ tier: string; nodes: Node[] }> = [
  {
    tier: "Interface",
    nodes: [
      { id: "next", name: "Next.js", icon: "next", accent: "#eef2fb", decision: { title: "App Router + streaming", text: "Route Handlers stream the answer token-by-token over SSE; the shell is serverless." } },
      { id: "react", name: "React", icon: "react", accent: "#61DAFB", decision: { title: "The workspace", text: "History sidebar, streaming chat, and a “show code” toggle — one focused client." } },
      { id: "ts", name: "TypeScript", icon: "ts", accent: "#3178C6", decision: { title: "Typed end-to-end", text: "Strict types across every workspace — core, web, MCP, eval — checked in CI." } },
      { id: "tw", name: "Tailwind", icon: "tailwind", accent: "#06B6D4", decision: { title: "The BIS system", text: "Design tokens map the whole app to the BIS identity — dark, on-brand." } },
      { id: "vercel", name: "Vercel", icon: "vercel", accent: "#eef2fb", decision: { title: "Serverless shell", text: "Vercel hosts the app; execution lives off-Vercel, since a sandbox can't run in a function." } },
    ],
  },
  {
    tier: "Core",
    nodes: [
      { id: "core", name: "@bis/core", icon: "core", accent: "#ff4757", decision: { title: "One core, many clients", text: "The UI, the MCP server, and the CLI all call one service through injected ports (LLM · sandbox · storage · data). No duplicated logic — the load-bearing decision." } },
    ],
  },
  {
    tier: "Data",
    nodes: [
      { id: "pg", name: "Postgres · Neon", icon: "postgres", accent: "#4169E1", decision: { title: "An audit trail", text: "Datasets, conversations, and a runs table — every number traces back to executed code. Serverless-safe on Neon." } },
      { id: "redis", name: "Redis · Upstash", icon: "redis", accent: "#FF4438", decision: { title: "Guardrails", text: "Per-IP rate limiting on the paid endpoints, and the bridge that lets an agent be the model." } },
    ],
  },
  {
    tier: "Execution",
    nodes: [
      { id: "sandbox", name: "E2B · Docker", icon: "docker", accent: "#2496ED", decision: { title: "The hard part", text: "Untrusted LLM code runs in an ephemeral sandbox — no network, read-only, torn down per run. Docker locally ↔ E2B in prod, behind one port." } },
    ],
  },
  {
    tier: "Intelligence",
    nodes: [
      { id: "llm", name: "Groq · Ollama", icon: "ollama", accent: "#ff8a4c", decision: { title: "Bring your own model", text: "Any model behind one openai-compatible interface — and never a number the code didn't produce." } },
    ],
  },
  {
    tier: "Agents & insight",
    nodes: [
      { id: "mcp", name: "MCP server", icon: "mcp", accent: "#34e0c0", decision: { title: "Agent-drivable", text: "An MCP server exposes the whole platform, so an external agent can pilot it — upload, ask, and pull back the code." } },
      { id: "posthog", name: "PostHog", icon: "posthog", accent: "#5b9bff", decision: { title: "It runs itself", text: "The funnel and per-analysis cost flow through one observability seam." } },
    ],
  },
];

const ALL = TIERS.flatMap((t) => t.nodes);

export function StackDiagram() {
  const [activeId, setActiveId] = useState("core");
  const active = ALL.find((n) => n.id === activeId)!;

  return (
    <div className="rounded-2xl border border-line bg-bg-2/40 p-5 sm:p-7">
      {/* Decision panel — updates on click */}
      <div key={activeId} className="fade-up mb-6 rounded-xl border border-line bg-surface/60 p-5">
        <div className="flex items-center gap-3">
          <span style={{ color: active.accent }}>
            <Glyph icon={active.icon} size={22} />
          </span>
          <div>
            <p className="text-sm font-semibold" style={{ color: active.accent }}>{active.decision.title}</p>
            <p className="text-xs text-ink/40">{active.name}</p>
          </div>
        </div>
        <p className="mt-3 text-sm leading-relaxed text-ink/80">{active.decision.text}</p>
      </div>

      {/* Tiers */}
      <div className="space-y-1">
        {TIERS.map((t, ti) => (
          <div key={t.tier}>
            <div className="flex flex-col items-center gap-2 sm:flex-row sm:items-center sm:gap-4">
              <span className="w-full text-center text-[10px] font-semibold uppercase tracking-[0.15em] text-ink/30 sm:w-28 sm:text-right">
                {t.tier}
              </span>
              <div className="flex flex-1 flex-wrap justify-center gap-2 sm:justify-start">
                {t.nodes.map((n) => {
                  const on = n.id === activeId;
                  return (
                    <button
                      key={n.id}
                      onClick={() => setActiveId(n.id)}
                      className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm transition ${
                        on ? "bg-surface" : "border-line bg-surface/40 text-ink/70 hover:text-ink"
                      }`}
                      style={on ? { borderColor: n.accent, color: "#eef2fb" } : undefined}
                    >
                      <span style={{ color: on ? n.accent : "#b3c0d8" }}>
                        <Glyph icon={n.icon} />
                      </span>
                      {n.name}
                    </button>
                  );
                })}
              </div>
            </div>
            {ti < TIERS.length - 1 && (
              <div className="flex justify-center py-1 text-ink/20 sm:pl-28">
                <svg width="12" height="14" viewBox="0 0 12 14" aria-hidden="true">
                  <path d="M6 0v10M2 7l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.3" />
                </svg>
              </div>
            )}
          </div>
        ))}
      </div>
      <p className="mt-5 text-center text-xs text-ink/40">
        Tap any piece to see the decision behind it.
      </p>
    </div>
  );
}
