import assert from "node:assert/strict";
import { test } from "node:test";
import { createCoreService, type CoreDeps } from "./service.js";
import type { LLMProvider } from "./llm/provider.js";
import type { ExecutionResult, Profiler, SandboxClient } from "./sandbox/client.js";
import type { Repositories } from "./db/repositories.js";
import type { Storage } from "./storage/client.js";
import type { Dataset } from "./types.js";

/**
 * TDD target: the code-gen -> execute -> interpret loop, with the error-repair
 * retry. Everything the loop touches is a fake, so these tests pin behavior —
 * especially "repair on a traceback" and "never fabricate a number" — without a
 * database, a model, or Docker.
 */

const dataset: Dataset = {
  id: "ds1",
  name: "sales.csv",
  sizeBytes: 1,
  storageKey: "ds1.csv",
  createdAt: new Date().toISOString(),
  profile: { rowCount: 2, columns: [] },
};

function fakeRepos() {
  const calls = {
    messages: [] as Array<{ role: string; content: string }>,
    runCompletions: [] as Array<{ id: string; status: string; repairAttempts?: number }>,
  };
  const repos = {
    datasets: {
      async create() { throw new Error("unused"); },
      async get(id: string) { return id === dataset.id ? dataset : null; },
      async list() { return [dataset]; },
    },
    conversations: {
      async create() { return { id: "conv1", datasetId: dataset.id, title: null, createdAt: new Date() }; },
      async get() { return { id: "conv1", datasetId: dataset.id, title: null, createdAt: new Date() }; },
      async listByDataset() { return []; },
      async list() { return []; },
    },
    messages: {
      async add(input: { conversationId: string; role: "user" | "assistant"; content: string }) {
        calls.messages.push({ role: input.role, content: input.content });
        return { id: `m${calls.messages.length}`, conversationId: input.conversationId, role: input.role, content: input.content, createdAt: new Date() };
      },
      async listByConversation() { return []; },
    },
    runs: {
      async create() { return { id: "run1", conversationId: "conv1", datasetId: dataset.id, messageId: null, question: "q", status: "pending" as const, code: null, stdout: null, stderr: null, repairAttempts: 0, durationMs: null, artifacts: null, createdAt: new Date() }; },
      async complete(id: string, patch: { status: "success" | "error"; repairAttempts?: number }) {
        calls.runCompletions.push({ id, status: patch.status, repairAttempts: patch.repairAttempts });
        return { id, conversationId: "conv1", datasetId: dataset.id, messageId: null, question: "q", status: patch.status, code: null, stdout: null, stderr: null, repairAttempts: patch.repairAttempts ?? 0, durationMs: null, artifacts: null, createdAt: new Date() };
      },
      async get() { return null; },
      async listByConversation() { return []; },
      async usageStats() { return { analyses: 0, successes: 0, avgDurationMs: 0, promptTokens: 0, completionTokens: 0 }; },
    },
  } satisfies Repositories;
  return { repos, calls };
}

const noopStorage: Storage = {
  async put(k) { return k; },
  async read() { return new Uint8Array(); },
  async exists() { return true; },
};
const noopProfiler: Profiler = { async profile() { return { rowCount: 0, columns: [] }; } };

/** Sandbox that returns a queued result per call, recording each request. */
function fakeSandbox(results: ExecutionResult[]): SandboxClient & { requests: string[] } {
  const requests: string[] = [];
  let i = 0;
  return {
    requests,
    async execute(req) {
      requests.push(req.code);
      const r = results[Math.min(i, results.length - 1)];
      i++;
      return r!;
    },
  };
}

/** LLM whose outputs are scripted; records the traceback repair saw and the stdout interpret saw. */
function fakeLLM(over: Partial<LLMProvider> = {}): LLMProvider & { seen: { tracebacks: string[]; interpretStdout: string[] } } {
  const seen = { tracebacks: [] as string[], interpretStdout: [] as string[] };
  return {
    seen,
    async generateCode() { return "print('first')"; },
    async repairCode(_code, traceback) { seen.tracebacks.push(traceback); return "print('repaired')"; },
    async interpret(_q, stdout) { seen.interpretStdout.push(stdout); return `interpretation of: ${stdout.trim()}`; },
    ...over,
  };
}

function ok(stdout: string): ExecutionResult {
  return { ok: true, stdout, stderr: "", timedOut: false, durationMs: 5, artifacts: [{ kind: "table", columns: ["c"], rows: [[1]] }] };
}
function fail(stderr: string): ExecutionResult {
  return { ok: false, stdout: "", stderr, timedOut: false, durationMs: 5, artifacts: [] };
}

function deps(over: Partial<CoreDeps>): CoreDeps {
  const { repos } = fakeRepos();
  return {
    repos,
    sandbox: fakeSandbox([ok("42")]),
    profiler: noopProfiler,
    storage: noopStorage,
    llm: () => fakeLLM(),
    maxRepairAttempts: 2,
    ...over,
  };
}

test("happy path: generate -> execute -> interpret, no repair", async () => {
  const sandbox = fakeSandbox([ok("SF leads: 3.25")]);
  const llm = fakeLLM();
  const svc = createCoreService(deps({ sandbox, llm: () => llm }));

  const result = await svc.analyze({ datasetId: "ds1", question: "which city sells most?" });

  assert.equal(result.execution.repairAttempts, 0);
  assert.equal(sandbox.requests.length, 1, "executed once");
  assert.equal(result.artifacts.length, 1);
  assert.match(result.interpretation, /3\.25/, "interpretation reflects executed stdout");
  assert.equal(llm.seen.interpretStdout[0], "SF leads: 3.25", "interpret grounded on real stdout");
});

test("repair path: a traceback triggers repairCode, then succeeds", async () => {
  const sandbox = fakeSandbox([fail("KeyError: 'ciry'"), ok("recovered: 7")]);
  const llm = fakeLLM();
  const svc = createCoreService(deps({ sandbox, llm: () => llm }));

  const result = await svc.analyze({ datasetId: "ds1", question: "q" });

  assert.equal(sandbox.requests.length, 2, "ran original then repaired code");
  assert.equal(sandbox.requests[1], "print('repaired')");
  assert.deepEqual(llm.seen.tracebacks, ["KeyError: 'ciry'"], "repair saw the real traceback");
  assert.equal(result.execution.repairAttempts, 1);
  assert.match(result.interpretation, /7/);
});

test("give-up path: exceeding maxRepairAttempts fails without fabricating a result", async () => {
  const sandbox = fakeSandbox([fail("boom")]); // always fails
  const llm = fakeLLM();
  const { repos, calls } = fakeRepos();
  const svc = createCoreService(deps({ sandbox, llm: () => llm, repos, maxRepairAttempts: 2 }));

  await assert.rejects(
    () => svc.analyze({ datasetId: "ds1", question: "q" }),
    /execution failed/i,
    "gives up rather than inventing an answer",
  );
  // original + 2 repairs = 3 executions, then stop
  assert.equal(sandbox.requests.length, 3);
  assert.equal(llm.seen.interpretStdout.length, 0, "never interprets a failed run");
  assert.equal(calls.runCompletions.at(-1)?.status, "error", "the run is recorded as error");
});

test("unknown dataset is rejected before any execution", async () => {
  const sandbox = fakeSandbox([ok("x")]);
  const svc = createCoreService(deps({ sandbox }));
  await assert.rejects(() => svc.analyze({ datasetId: "nope", question: "q" }), /dataset/i);
  assert.equal(sandbox.requests.length, 0);
});
