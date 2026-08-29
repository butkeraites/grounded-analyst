# Julius clone — AI data analyst

[![CI](https://github.com/butkeraites/julius-clone/actions/workflows/ci.yml/badge.svg)](https://github.com/butkeraites/julius-clone/actions/workflows/ci.yml)

Upload a dataset, ask a question in plain English, and get back a chart, a table,
and a written interpretation — from **real Python executed in an isolated
sandbox**, never a number the model guessed. A portfolio clone of
[Julius.AI](https://julius.ai) built on its exact stack.

> **Status: live and end-to-end.** Deployed on **Vercel + Neon + E2B + Groq**
> (the deployment mirrors Julius's own stack), and runs 100% local in Docker for
> development. Upload → data profile → ask → **real Python executed in an isolated
> sandbox** → streamed prose + chart + table + the generated code.
>
> The live demo is password-gated (it executes code and calls a paid LLM) —
> ask for the password.

![The core loop: ask a question → streamed prose → a real matplotlib chart → a result table → the generated Python, on toggle.](docs/loop.gif)

<sub>The full loop end-to-end — grounded interpretation, a real chart, the result table, and the generated Python revealed by "show code". ([still image](docs/workspace.jpg))</sub>

## Stack

Next.js (App Router) · React · TypeScript · Tailwind · Postgres · Redis · PostHog
(no-op locally) · a Python sandbox (later milestone).

**Bring your own LLM.** The analyst never hard-codes a model. Providers are
supplied via config (`LLMConfig`), layered as a deployment default plus an
optional per-request override — so you can point it at a fully-local Ollama, a
cloud API, or let an MCP caller bring its own model. `openai-compatible` is the
lingua franca (OpenAI, Ollama, LM Studio, vLLM, Groq, Together); Anthropic gets
a thin adapter. The interface + config seam exist today; adapters land with the
sandbox milestone.

## Run locally

Everything comes up with one command — no hosted vendor required.

```bash
cp .env.example .env
docker compose up --build
```

Then:

- App: <http://localhost:3000>
- **Health proof** (live probe of web + Postgres + Redis): <http://localhost:3000/health>
- JSON: `curl http://localhost:3000/api/health` → `{"status":"ok","db":"ok","redis":"ok"}`

The three **suggested questions** answer instantly (from a recorded cassette).
To ask **arbitrary** questions fully locally, pull the code model once — the
`ollama` service is already in the stack:

```bash
docker compose exec ollama ollama pull qwen2.5-coder:3b
```

Now any question is answered by the local model (no external API). Swap
`LLM_MODEL` in `docker-compose.yml` for a bigger model (e.g. `:7b`) for higher
quality.

Edit `apps/web/app/page.tsx` and the browser hot-reloads (source is bind-mounted).
If port 3000 is already taken, set `WEB_PORT` in `.env` (e.g. `WEB_PORT=3001`).

## Layout

```
apps/web/            Next.js UI + API (route handlers); lib/db delegates to the core
apps/mcp/            MCP server — an MCP host can BE the platform's model (bridge worker tools)
packages/core/       THE core analyst service — one core, many clients (UI, MCP, CLI)
  src/service.ts     createCoreService(deps): upload + the analyze loop
  src/sandbox/       SandboxClient/Profiler ports + the DockerSandbox adapter
  src/llm/           LLMProvider port; the MCP bridge + record/replay cassette adapters
  src/db/            schema, repositories, migration runner (shared by all clients)
  src/storage/       Storage port + LocalStorage adapter
  src/cli/           headless driver + the model-worker CLI
  drizzle/           generated SQL migrations
sandbox/             the sandbox image (Python data stack) + runner.py harness
seed/                demo dataset + recorded cassette
docker-compose.yml   web + postgres + redis + a one-shot migrate service
```

`packages/core` is the load-bearing seam: `upload → profile → code-gen → execute
→ interpret`, defined as a callable contract before any client exists. It also
**owns persistence** — the schema and repositories live here, not in the web
app, so the MCP server reuses them with no duplicated query logic.

**Read [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)** for the design record:
the one-core-many-clients seam, the sandbox (optimal vs. practical) and its
threat model, the code-gen→execute→interpret loop, BYO-LLM, and what I'd do with
more time. See [`CLAUDE.md`](./CLAUDE.md) for the build plan.

## Database & migrations

The schema (`datasets → conversations → messages`, plus `runs` recording every
code-gen→execute) is defined with Drizzle in `packages/core/src/db/schema.ts`.

- `docker compose up` runs a one-shot **`migrate`** service that applies pending
  migrations before the web app starts (`web` waits for it to finish).
- Change the schema, then regenerate the SQL:
  `npm run db:generate --workspace @julius/core`.
- If you change dependencies, rebuild so the container picks them up:
  `docker compose up -d --build` (add `-v` first to reset the DB volume).

## Sandbox — untrusted code execution

The hard part. LLM-generated Python runs in an **ephemeral container per request**
(`docker run --rm`), torn down immediately after. Isolation is enforced at the
container boundary, not in Python: `--network none`, `--read-only`, `--cap-drop
ALL`, `--security-opt no-new-privileges`, unprivileged user, CPU/memory/pids
caps, the dataset mounted read-only, and a hard wall-clock timeout that kills
the container. The orchestration loop (`analyze`) code-gens → executes → and, on
a traceback, feeds the error back for a repair before retrying — and never
writes an interpretation for a run that didn't succeed, so no number is ever
fabricated. Build the image once:

```bash
docker build -t julius-sandbox:latest ./sandbox
```

## Bring your own LLM — including *an MCP host as the model*

The analyst never hard-codes a model; the provider is injected. That makes the
most interesting adapter possible: **Claude itself powers the platform over
MCP.** The `analyze` loop calls a normal `LLMProvider`; `McpBridgeLLMProvider`
enqueues each code-gen / repair / interpret request onto a Redis bridge and
blocks until a worker answers. The MCP server (`apps/mcp`) exposes that worker
side as tools — `llm_pull_request` / `llm_submit_response` — so any MCP host
becomes the platform's brain. None of this touches the core: it's just an
`LLMProvider`.

The three seeded questions are served by a **record/replay cassette**
(deterministic, no model needed); everything else is answered by a **local
Ollama** via the `openai-compatible` adapter — still 100% local, no external API.
`CompositeLLMProvider` tries the cassette first, then the configured model
(Ollama by default, or the MCP bridge). Point `LLM_BASE_URL`/`LLM_MODEL` at any
OpenAI-compatible endpoint (OpenAI, Groq, vLLM, …) to swap it.

Headless proof (Claude as the model, over the Redis bridge):

```bash
docker compose up -d postgres redis && docker compose run --rm migrate
# terminal A — runs the loop, blocks waiting for the model:
npm run cli:analyze -- seed/sales.csv "Which region generates the most revenue?"
# terminal B — the model answers (this is what the MCP tools wrap):
npm run cli:worker -- pull            # prints the code-gen request + schema
npm run cli:worker -- respond <id> gen.py
npm run cli:worker -- pull            # prints the interpret request + real stdout
npm run cli:worker -- respond <id> answer.txt
```

To drive it as a real MCP server instead, a fresh Claude session picks up
`.mcp.json` and calls the tools directly.

## The platform as an MCP server — the differentiator

Julius is an MCP *client* and has no public API; this clone exposes **itself** as
an MCP server (`apps/mcp`), so any agent can pilot the whole platform. Every
analyst tool routes through the same core the UI uses — a thin adapter, not a
reimplementation:

`upload_dataset` · `list_datasets` · `suggest_questions` · `run_analysis` ·
`get_code` · `get_table` · `get_chart` · `list_conversations` · `get_conversation`
(plus the `llm_pull_request` / `llm_submit_response` worker tools).

Exposing `get_code` — the generated Python, not just the answer — is what makes
an analyst-over-MCP auditable and composable instead of a black box.

**Living proof:** an example agent drives a full analysis end-to-end over MCP —
upload → ask → pull back the code, table, and chart — unattended:

```bash
docker compose up -d postgres redis && docker compose run --rm migrate
docker build -t julius-sandbox:latest ./sandbox
npm run agent --workspace mcp
```

A recorded run ([`docs/agent-run.txt`](docs/agent-run.txt)):

```text
→ upload_dataset(sales.csv)
  dataset ab66d79b…: 12 rows, 5 columns
→ run_analysis("Which region generates the most revenue…?")
  interpretation: North is the top-revenue region at $26,990, ahead of South's $21,800…
  artifacts: chart, table · runId fb4b212a…
→ get_code(runId)   region_rev = df.groupby('region')['revenue'].sum()…
→ get_table(runId)  columns: region, Gadget, Widget · 2 rows
→ get_chart(runId)  received image/png chart (27681 bytes)
✓ uploaded, asked, and pulled back interpretation + code + table + chart — entirely over MCP.
```

## Tests

Critical-path tests, most run against the **real** Postgres + sandbox:

```bash
docker build -t julius-sandbox:latest ./sandbox         # once
docker compose up -d postgres && docker compose run --rm migrate
DATABASE_URL=postgres://julius:julius@localhost:5432/julius \
  npm test --workspace @julius/core
```

Covers: the code-gen→execute→interpret loop with error-repair (fakes, fast),
real container execution (compute, charts, tables, crash→traceback, **network
blocked**, **timeout killed**), profiling, upload, the persistence round-trip,
the LLM bridge + cassette, and a full **replay** run (seeded demo, no model
attached). Each test self-skips if its dependency (Docker image / `DATABASE_URL`)
is absent.

## Measured quality — the eval harness

`npm run eval` runs the real loop over a golden set and scores **execution-based
correctness** (do the expected values appear in the *executed* output?) and
**grounding faithfulness** (is every data figure in the interpretation actually
produced by the code?) — turning "never fabricate" into a measured property. It
runs deterministically in **cassette mode** ($0, the CI gate) or **live** against
a real model. **CI** (`.github/workflows/ci.yml`) gates every PR with typecheck +
lint + build + tests + the eval regression gate — all free, no paid APIs.

## What's next

Token-level streaming (the SSE plumbing already handles incremental events);
removing the host-daemon exposure (rootless Docker / a spawn broker / gVisor);
and a Vercel deployment of the app shell with the sandbox and Postgres/Redis
off-Vercel. See [`docs/ARCHITECTURE.md` §8](docs/ARCHITECTURE.md) for the full
list.
