import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { CoreService, LlmBridge, Repositories } from "@julius/core";

/**
 * Julius-clone MCP tool surface — the capability surface Julius itself doesn't
 * ship (it is an MCP *client*; it exposes no MCP server and no public API).
 *
 * Every analyst tool routes through the SAME core the web UI uses. This module
 * is a thin protocol adapter, not a reimplementation — that's the whole proof:
 * an external agent pilots the entire platform (upload, ask, and pull back the
 * chart, table, AND the generated code).
 *
 * It lives in its own package rather than in either entry point because there
 * are now TWO transports over this one surface:
 *   - `apps/mcp/src/server.ts`          — stdio, for a local MCP host
 *   - `apps/web/app/api/mcp/route.ts`   — Streamable HTTP, for the live deploy
 * Same seam as the core itself: one implementation, many clients. Adding the
 * HTTP transport had to cost zero duplicated tool logic, or the seam was fake.
 */

export interface JuliusMcpDeps {
  service: CoreService;
  repos: Repositories;
  /**
   * The LLM bridge backing the worker tools. Optional: without it the analyst
   * tools still work (cassette replay or a configured BYO model), and the
   * `llm_*` tools are simply not registered — which is the right shape for the
   * serverless HTTP transport, where a long `llm_pull_request` poll would just
   * burn the function's wall clock.
   */
  bridge?: LlmBridge;
}

export const SERVER_INFO = { name: "julius-clone", version: "0.1.0" } as const;

const text = (value: unknown) => ({
  content: [
    { type: "text" as const, text: typeof value === "string" ? value : JSON.stringify(value, null, 2) },
  ],
});

/** Build a fully-registered MCP server over the given core. */
export function createJuliusMcpServer({ service, repos, bridge }: JuliusMcpDeps): McpServer {
  const server = new McpServer(SERVER_INFO);

  // ---- Analyst surface (routes through the core) --------------------------

  server.registerTool(
    "upload_dataset",
    {
      title: "Upload a dataset",
      description: "Ingest a CSV (by content) → profiled dataset. Returns the dataset id, shape, and column types.",
      inputSchema: {
        name: z.string().describe("Filename, e.g. sales.csv"),
        content: z.string().describe("The CSV file contents."),
      },
    },
    async ({ name, content }) => {
      const dataset = await service.upload({
        name,
        contentType: "text/csv",
        bytes: new TextEncoder().encode(content),
      });
      return text({
        datasetId: dataset.id,
        name: dataset.name,
        rows: dataset.profile.rowCount,
        columns: dataset.profile.columns.map((c) => ({ name: c.name, type: c.dtype })),
      });
    },
  );

  server.registerTool(
    "list_datasets",
    { title: "List datasets", description: "Enumerate datasets with their shape.", inputSchema: {} },
    async () => {
      const datasets = await repos.datasets.list();
      return text(
        datasets.map((d) => ({
          datasetId: d.id,
          name: d.name,
          rows: d.profile.rowCount,
          columns: d.profile.columns.length,
        })),
      );
    },
  );

  server.registerTool(
    "suggest_questions",
    {
      title: "Suggest questions",
      description: "Starter questions derived from a dataset's profile.",
      inputSchema: { datasetId: z.string() },
    },
    async ({ datasetId }) => text(await service.suggestQuestions(datasetId)),
  );

  server.registerTool(
    "run_analysis",
    {
      title: "Ask a question of a dataset",
      description:
        "Natural-language question → the core writes Python, runs it in the sandbox, and interprets the result. " +
        "Returns runId (handle for get_code/get_chart/get_table), the interpretation, and which artifacts exist.",
      inputSchema: {
        datasetId: z.string(),
        question: z.string(),
        conversationId: z.string().optional().describe("Continue an existing thread."),
      },
    },
    async ({ datasetId, question, conversationId }) => {
      const result = await service.analyze({ datasetId, question, conversationId });
      return text({
        runId: result.runId,
        conversationId: result.conversationId,
        interpretation: result.interpretation,
        artifacts: result.artifacts.map((a) => a.kind),
        repairAttempts: result.execution.repairAttempts,
      });
    },
  );

  server.registerTool(
    "get_code",
    {
      title: "Get the generated code",
      description: "The Python the analyst ran for a run — the differentiator that makes results auditable.",
      inputSchema: { runId: z.string() },
    },
    async ({ runId }) => {
      const run = await repos.runs.get(runId);
      if (!run) return text(`run not found: ${runId}`);
      return text(run.code ?? "(no code recorded)");
    },
  );

  server.registerTool(
    "get_table",
    {
      title: "Get the result table",
      description: "The structured result table produced by a run.",
      inputSchema: { runId: z.string() },
    },
    async ({ runId }) => {
      const run = await repos.runs.get(runId);
      const table = run?.artifacts?.find((a) => a.kind === "table");
      return text(table ?? "(no table for this run)");
    },
  );

  server.registerTool(
    "get_chart",
    {
      title: "Get the chart",
      description: "The chart image produced by a run (PNG).",
      inputSchema: { runId: z.string() },
    },
    async ({ runId }) => {
      const run = await repos.runs.get(runId);
      const chart = run?.artifacts?.find((a) => a.kind === "chart");
      if (!chart || chart.kind !== "chart") return text("(no chart for this run)");
      return { content: [{ type: "image" as const, data: chart.data, mimeType: chart.mimeType }] };
    },
  );

  server.registerTool(
    "list_conversations",
    {
      title: "List conversations",
      description: "Prior analysis threads, optionally scoped to a dataset.",
      inputSchema: { datasetId: z.string().optional() },
    },
    async ({ datasetId }) => {
      const rows = datasetId
        ? await repos.conversations.listByDataset(datasetId)
        : await repos.conversations.list();
      return text(rows.map((c) => ({ conversationId: c.id, datasetId: c.datasetId, createdAt: c.createdAt })));
    },
  );

  server.registerTool(
    "get_conversation",
    {
      title: "Get a conversation",
      description: "The message thread (user + assistant turns) for a conversation.",
      inputSchema: { conversationId: z.string() },
    },
    async ({ conversationId }) => {
      const messages = await repos.messages.listByConversation(conversationId);
      return text(messages.map((m) => ({ role: m.role, content: m.content })));
    },
  );

  // ---- LLM-worker surface (an MCP host can BE the model) ------------------

  if (bridge) registerLlmWorkerTools(server, bridge);

  return server;
}

function registerLlmWorkerTools(server: McpServer, bridge: LlmBridge): void {
  server.registerTool(
    "llm_pull_request",
    {
      title: "Pull an LLM request",
      description:
        "Take the next request the platform needs its model to answer (generateCode / repairCode / interpret), " +
        "then answer with llm_submit_response. Use when a question isn't already covered by the seeded cassette.",
      inputSchema: { timeoutMs: z.number().optional() },
    },
    async ({ timeoutMs }) => {
      const req = await bridge.pull(timeoutMs ?? 30_000);
      return text(req ?? "no pending request");
    },
  );

  server.registerTool(
    "llm_submit_response",
    {
      title: "Submit an LLM response",
      description: "Deliver the answer for a pulled request: raw Python for code, grounded prose for interpret.",
      inputSchema: { id: z.string(), text: z.string() },
    },
    async ({ id, text: answer }) => {
      await bridge.respond(id, answer);
      return text(`delivered response for ${id}`);
    },
  );
}
