import assert from "node:assert/strict";
import { test } from "node:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import type { CoreService, Repositories } from "@julius/core";
import { handleMcpHttpRequest } from "./http";

/**
 * The remote transport's critical path: a REAL MCP client speaking Streamable
 * HTTP to the real handler, over a fake core. No socket — the client's fetch is
 * pointed straight at `handleMcpHttpRequest`, which is exactly what the Vercel
 * route hands each request.
 *
 * What this pins down is the thing that broke the deployment before: the tools
 * are only pilotable remotely if initialize → tools/list → tools/call all
 * survive a stateless, one-transport-per-request server. It also guards the
 * seam — the tool list asserted here is the same surface the stdio entry point
 * serves, so a tool added to one transport can't quietly skip the other.
 */

const analyzeResult = {
  runId: "run_1",
  conversationId: "conv_1",
  interpretation: "Revenue grew 12% quarter over quarter.",
  artifacts: [{ kind: "chart" }, { kind: "table" }],
  execution: { repairAttempts: 1 },
};

function fakeDeps() {
  const calls: Array<{ tool: string; args: unknown }> = [];
  const service = {
    async upload(input: { name: string }) {
      calls.push({ tool: "upload", args: input });
      return {
        id: "ds_1",
        name: input.name,
        profile: { rowCount: 3, columns: [{ name: "revenue", dtype: "float64" }] },
      };
    },
    async suggestQuestions(datasetId: string) {
      calls.push({ tool: "suggestQuestions", args: datasetId });
      return ["How did revenue trend?"];
    },
    async analyze(input: unknown) {
      calls.push({ tool: "analyze", args: input });
      return analyzeResult;
    },
  } as unknown as CoreService;

  const repos = {
    datasets: { async list() { return []; } },
    runs: {
      async get(id: string) {
        calls.push({ tool: "runs.get", args: id });
        return id === "run_1" ? { id, code: "df.groupby('quarter').revenue.sum()" } : null;
      },
    },
    conversations: { async list() { return []; }, async listByDataset() { return []; } },
    messages: { async listByConversation() { return []; } },
  } as unknown as Repositories;

  return { deps: { service: () => service, repos: () => repos }, calls };
}

/**
 * Build an MCP client whose transport posts into the handler. A fresh Request
 * per call is the point: stateless mode forbids reusing a transport, so this
 * mirrors how Vercel invokes the route — cold, once per message.
 */
async function connectedClient(deps: ReturnType<typeof fakeDeps>["deps"]) {
  const client = new Client({ name: "test-host", version: "0.0.0" });
  const transport = new StreamableHTTPClientTransport(new URL("https://example.test/api/mcp"), {
    fetch: async (url, init) => handleMcpHttpRequest(new Request(url, init), deps),
  });
  await client.connect(transport);
  return client;
}

test("http transport: an MCP client can initialize and list the full tool surface", async () => {
  const { deps } = fakeDeps();
  const client = await connectedClient(deps);

  const names = (await client.listTools()).tools.map((t) => t.name).sort();
  assert.deepEqual(names, [
    "get_chart",
    "get_code",
    "get_conversation",
    "get_table",
    "list_conversations",
    "list_datasets",
    "run_analysis",
    "suggest_questions",
    "upload_dataset",
  ]);
  await client.close();
});

test("http transport: the llm-worker tools are absent without a bridge", async () => {
  const { deps } = fakeDeps();
  const client = await connectedClient(deps);

  const names = (await client.listTools()).tools.map((t) => t.name);
  assert.equal(names.some((n) => n.startsWith("llm_")), false);
  await client.close();
});

test("http transport: run_analysis routes through the core and returns the run handle", async () => {
  const { deps, calls } = fakeDeps();
  const client = await connectedClient(deps);

  const res = await client.callTool({
    name: "run_analysis",
    arguments: { datasetId: "ds_1", question: "How did revenue trend?" },
  });

  const content = res.content as Array<{ type: string; text: string }>;
  const payload = JSON.parse(content[0]!.text);
  assert.equal(payload.runId, "run_1");
  assert.equal(payload.interpretation, analyzeResult.interpretation);
  assert.deepEqual(payload.artifacts, ["chart", "table"]);
  assert.equal(payload.repairAttempts, 1);
  assert.deepEqual(calls, [
    { tool: "analyze", args: { datasetId: "ds_1", question: "How did revenue trend?", conversationId: undefined } },
  ]);
  await client.close();
});

test("http transport: get_code returns the executed Python, and 404s cleanly", async () => {
  const { deps } = fakeDeps();
  const client = await connectedClient(deps);

  const found = await client.callTool({ name: "get_code", arguments: { runId: "run_1" } });
  assert.match((found.content as Array<{ text: string }>)[0]!.text, /groupby\('quarter'\)/);

  const missing = await client.callTool({ name: "get_code", arguments: { runId: "nope" } });
  assert.equal((missing.content as Array<{ text: string }>)[0]!.text, "run not found: nope");
  await client.close();
});

test("http transport: a stateless transport is never reused across requests", async () => {
  const { deps } = fakeDeps();
  const client = await connectedClient(deps);

  // Two calls on one client: each must get its own server + transport, or the
  // SDK throws "Stateless transport cannot be reused across requests."
  await client.listTools();
  await client.listTools();
  await client.close();
});

test("http transport: tools/list survives a core that cannot be built", async () => {
  // A deployment with a missing DATABASE_URL used to answer every call — even
  // discovery — with an opaque 500, so an agent couldn't even see the surface.
  const broken = {
    service: () => {
      throw new Error("DATABASE_URL is not set");
    },
    repos: () => {
      throw new Error("DATABASE_URL is not set");
    },
  };
  const client = await connectedClient(broken);
  assert.equal((await client.listTools()).tools.length, 9);

  // ...and the tool that does need the core says what is actually wrong,
  // instead of the transport swallowing it.
  const res = await client.callTool({ name: "list_datasets", arguments: {} });
  assert.equal(res.isError, true);
  assert.match((res.content as Array<{ text: string }>)[0]!.text, /DATABASE_URL is not set/);
  await client.close();
});

test("http transport: GET and DELETE get a 405, not a stream that never speaks", async () => {
  const { deps } = fakeDeps();
  for (const method of ["GET", "DELETE"]) {
    const res = await handleMcpHttpRequest(
      new Request("https://example.test/api/mcp", { method, headers: { accept: "text/event-stream" } }),
      deps,
    );
    // Left to the transport, GET answers 200 text/event-stream and the client
    // waits forever for a notification a stateless server will never send.
    assert.equal(res.status, 405, `${method} should be rejected`);
    assert.equal(res.headers.get("Allow"), "POST");
  }
});
