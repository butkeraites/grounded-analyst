# Grounded — Staff-Engineer Reference Build

## Why this repo exists (read first)

Grounded is a **deep, production-grade reference build of an AI data analyst**,
engineered by BIS. It is a deliberate demonstration of staff-level judgment: not a
broad feature-complete product, but a **small, deep, well-documented vertical
slice** with the dangerous part — securely executing untrusted, LLM-generated code
— solved for real.

**The single sentence that governs every decision here:** *narrow scope, deep execution, the hard part solved for real, and the decisions documented.* Five half-features signal the opposite of staff. One impeccable end-to-end flow, with the dangerous part handled well and an architecture doc explaining the tradeoffs, is the signal.

## Who built it

Renan Butkeraites — PhD in Operations Research, ~10 years shipping **Python, ML, and optimization in production**; recently applied-AI / LLM systems (RAG, evaluation, redaction), builds with Claude Code daily.

- **The strength on display:** Python, data, code execution, systems thinking, LLM orchestration, architecture judgment — with the hard part (the Python sandbox) turned from a risk into the differentiator, wrapped in clean, intentional React/TS/Tailwind that does not look AI-generated.

## What Grounded is

An **AI data analyst**: upload a dataset, ask a question in plain English, and it **writes and runs real Python**, then returns a **chart + a data table + a written interpretation, inline in the chat.** It is *not* the model guessing numbers — it executes pandas/matplotlib/statsmodels/scikit-learn in an **isolated container** and streams results back.

**The core UX loop (this is the whole MVP):**
1. Clean workspace; **paperclip → upload a CSV/Excel**.
2. On upload: render a **data-preview table** + **auto-generated suggested questions** derived from the columns.
3. User types a question (bonus: a **`/` command menu**).
4. Backend writes Python, runs it in a **sandbox**, and the assistant turn **streams** back three things: **(a) prose interpretation, (b) a rendered chart, (c) a result table.**
5. A **"show code" toggle** exposes the generated Python (transparency is a core selling point).
6. Follow-up questions keep **conversation context**; threads persist.

**Deliberately OUT of scope** (name them in the ADR as "known extensions," do not build): Notebooks/templates, Models Lab, Slides/Tasks/Excel export, multi-model switching, live database connections, auth/billing, teams. Common category gaps (>50MB files, no live DB at entry tier) are things to *mention you'd add*, not build.

## Stack

| Layer | Use | Notes |
|---|---|---|
| Framework | **Next.js (App Router) + React + TypeScript** | Vercel-native. Server Components where sensible; Route Handlers for the API. |
| Styling | **Tailwind CSS** | Clean, intentional UI. See "UI taste" below — must NOT look AI-generated. |
| DB | **Postgres** | Conversations, messages, datasets metadata, run records. Use Vercel Postgres or Neon. |
| Cache/queue/realtime | **Redis** | Session state, run status, rate-limit, and/or pub-sub for streaming. Upstash works on Vercel. |
| Deploy | **Vercel-ready** | The app shell + API deploy to Vercel; the sandbox and Postgres/Redis live off-Vercel. Source-available — runs 100% local via Docker, no hosted demo. |
| Analytics | **PostHog** | Instrument the real funnel: upload → question → run → chart rendered. Show you measure. |
| Python sandbox | a separate execution service | NOT on Vercel (long-running). See architecture. |

A modern, widely-used product stack, chosen on purpose; the interesting engineering is the sandbox and the core seam, not the framework.

## Architecture — the hard part is the whole point

The interesting engineering problem, and the one that shows staff judgment, is **securely executing untrusted, LLM-generated Python and streaming results back to the chat.** Own this explicitly.

- **Execution:** run generated code in an **isolated sandbox** with no host access, a **timeout**, resource limits, and a per-session lifecycle (spin up, execute, tear down). Candidate options to evaluate in the ADR: **E2B**, **Modal**, a **Docker/Firecracker** worker, or a hardened local subprocess for the MVP. Pick one, justify it as *optimal vs. practical for an MVP*.
- **Streaming:** the assistant turn must **stream** — prose tokens first, chart + table as the code finishes. Use **SSE or WebSocket**; wire it through a Route Handler / a small backend, with Redis as the pub-sub or status channel if it helps.
- **The LLM step:** an orchestration layer that turns a natural-language question + the dataframe schema into runnable Python, then feeds execution results (and errors) back for interpretation. **This is where LLM/agent engineering shows** — grounding, error-repair loop (if the generated code throws, feed the traceback back and retry), and never letting the model fabricate a number it didn't compute.
- **Data flow:** upload → store + profile the dataset (types, missing values, shape) → schema informs both the suggested questions and the code-gen prompt.

Write the code so a reviewer can see the **boundaries**: `app/` (UI), an API layer, a sandbox client, an LLM orchestration module, and a data/persistence layer. Clear seams are a staff signal.

**The core-service principle (this is the load-bearing architecture decision):** the **web UI and the MCP server (below) are two clients of ONE core service** — upload → profile → code-gen → execute → interpret. Do not build the agent surface as a parallel path bolted on later. Design the core as a callable module/service from day one; the Next.js API and the MCP server both call *into* it. If adding the MCP server later forces you to duplicate logic, the core was too coupled to the UI — that coupling, and fixing it, is the staff-level lesson to surface in the ADR.

## Agent-drivable platform (MCP) — the differentiator

**The gap being filled:** tools in this category are typically MCP **clients** — they *consume* external MCP servers as data connectors — but do **not** expose themselves as an MCP server, and ship **no public API** an external agent could call. So **building the platform as an MCP server is a genuine gap**, in the exact direction the category is moving. This is the strongest single pitch in the whole project: *"an external agent can pilot the entire platform."*

Build an **MCP server** that exposes the platform's full capability surface, so any MCP host (Claude, Claude Code, etc.) can drive it end to end. Tools to expose:

| Tool | Does | Notes |
|---|---|---|
| `upload_dataset` | push a CSV/xlsx/Parquet, return a dataset ID | same ingestion path as the UI |
| `list_datasets` | enumerate datasets + their schemas | |
| `ask` / `run_analysis` | natural-language question against a dataset → answer + artifact IDs | the core loop, headless |
| `get_chart` | fetch a generated chart (image or spec) | |
| `get_table` | fetch a result table as structured data | |
| `get_code` | fetch the generated Python | **the differentiator** — exposing the code (not just the answer) is what makes an analyst-MCP auditable and composable vs a black box; call this out in the pitch |
| `list_conversations` / `get_conversation` | retrieve prior analysis threads | continuity across agent turns |

Every one of these must route through the **same core service** the UI uses — the MCP server is a thin protocol adapter over the core, not a reimplementation. That is the whole point and the whole proof.

**Living proof (deliverable):** ship a short **example agent script** (or a recorded Claude Code session) that connects to the MCP server and autonomously does a full analysis: upload a dataset → ask 2–3 questions → pull back a chart, a table, and the generated code → summarize. This is the artifact that demonstrates "an external agent can pilot the whole platform," not just claims it. Put the transcript/GIF in the README.

## MANDATORY deliverables (not optional)

These are what convert "built a demo" into "thinks like staff." Do not skip them.

1. **Live deployment on Vercel** — a working URL, seeded so it demos in 30 seconds without setup.
2. **A working MCP server** exposing the tool set above, driving the same core service as the UI. This is the differentiator — Grounded has no such server or public API.
3. **An example agent piloting via MCP** — a script or recorded Claude Code session that autonomously runs a full analysis through the MCP server (upload → ask → chart + table + code → summary). The living proof that an external agent can pilot the whole platform.
4. **`docs/ARCHITECTURE.md` (ADR-style)** — the money document. Cover: the **core-service seam** (one core, two clients: UI + MCP), the sandbox choice (**optimal vs. practical** — the classic staff judgment call), the streaming approach, how untrusted code is isolated, the code-gen + error-repair loop, why the platform-as-MCP-server matters, what you'd do with more time (scaling, multi-model, live DB connectors, larger files), and honest tradeoffs. This doc is read as your "opinions about architecture."
5. **Tests on the critical path** — at minimum: the code-execution/sandbox boundary and the code-gen→execute→interpret loop. Proves "strong engineering fundamentals, not just vibecoding." A couple of meaningful tests beat broad shallow coverage.

Also expected: a **README** with a 3-line pitch, the live link, a GIF/screenshot of the core loop, run-locally steps, and a short "what I'd build next."

## UI taste (cheap, high-visibility signal)

The UI must **not look AI-generated.** So: restrained palette, real spacing rhythm, one good font, subtle motion, empty/loading/error states designed on purpose, charts that look publication-quality (the category's signature). This is disproportionately visible to a reviewer in 10 seconds — invest a focused pass, don't over-build.

## Scored study plan (weighted — score yourself before you ship)

Weighting reflects what signals **staff**, not what's easiest. Grade each 0–100; the goal is a high **weighted** total, and deliberately heavier on the hard/architecture items.

| # | Deliverable | Weight | What "done well" means |
|---|---|---|---|
| 1 | **Core service seam** (one core; UI + MCP both call into it) | **15%** | No duplicated logic between UI and MCP paths. Clean, callable core. |
| 2 | **Python sandbox execution** (secure, isolated, timeout, teardown) | **20%** | Real untrusted-code execution, not mocked. Isolation + limits are real. |
| 3 | **MCP server** (full tool set, drives the core) | **15%** | An MCP host can connect and invoke every tool; thin adapter over the core, not a reimplementation. |
| 4 | **Example agent piloting via MCP** (autonomous end-to-end) | **10%** | A recorded run: agent uploads, asks, pulls chart+table+code, summarizes — unattended. |
| 5 | **Streaming code-gen→execute→interpret loop** (incl. error-repair) | **15%** | Prose + chart + table stream back; generated-code errors are caught and repaired, numbers never fabricated. |
| 6 | **ARCHITECTURE.md / ADR** (optimal vs practical) | **12%** | Clear decisions, honest tradeoffs, "what I'd do next." Reads as staff judgment. |
| 7 | **Core UX loop end-to-end** (upload → preview → suggested Qs → chat → show-code) | **6%** | The whole slice works, deployed, demo-able in 30s. |
| 8 | **Frontend fundamentals + UI taste** (clean React/TS/Tailwind, states, chart quality) | **4%** | Solid React fundamentals, not vibecoded; UI that doesn't look AI-generated. |
| 9 | **Critical-path tests** | **2%** | Sandbox boundary + orchestration loop covered meaningfully. |
| 10 | **PostHog instrumentation + README/live link** | **1%** | Funnel measured; repo + live site are self-explanatory. |

Score after a working build; anything under ~70 on items 1–5 (the core, the sandbox, the MCP, the agent demo, the streaming loop) means the staff signal is weak — fix those before polishing UI. Items 7–10 are cheap-but-visible finishing; do not let them eat time budgeted for 1–5.

## Guardrails / non-goals

- **Match the stack; don't wander.** No auth systems, no billing, no teams, no Notebooks mode. Depth over breadth — every hour on an out-of-scope feature is an hour not spent on the sandbox or the ADR.
- **Never let the model fabricate results.** Any number, table, or chart must come from executed code over the real uploaded data. This is both a correctness principle and a Grounded product principle — treat any model-produced fact as unverified until the sandbox produced it.
- **Secure the sandbox for real.** Untrusted LLM-generated code runs here; no host filesystem/network access, hard timeouts, resource caps. Document the threat model in the ADR.
- **Keep it demo-able.** Seed a dataset so the demo works instantly. A reviewer's 30-second look decides everything.
- **Ship at startup pace.** Prefer a working narrow slice today over a perfect broad plan next week.

## Suggested milestones (adjust freely)

1. **Skeleton + deploy** — Next.js app on Vercel, Postgres + Redis wired, PostHog firing, a "hello" page live. (Prove the pipe end-to-end first.)
2. **The core service** — define the callable core (upload → profile → code-gen → execute → interpret) as a module/service with a clean interface, before any client. The UI and MCP will both call this.
3. **The hard part** — sandbox executes generated Python over the dataframe; wire the code-gen→execute→interpret loop with error-repair. Drive it first from a test/CLI, not the UI.
4. **Web client** — upload → preview → suggested questions → streaming chat (prose + chart + table) → "show code" toggle → conversation context.
5. **MCP server** — expose the tool set over the same core; connect an MCP host and invoke each tool.
6. **Agent demo** — record an external agent autonomously piloting the platform via MCP end to end.
7. **Polish + prove** — UI taste pass, critical-path tests, write ARCHITECTURE.md and README, final deploy, record the GIFs (UI loop + agent-via-MCP run).

When in doubt, re-read the governing sentence at the top: **narrow, deep, hard-part-solved, documented.**
