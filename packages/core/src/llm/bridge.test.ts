import assert from "node:assert/strict";
import { test } from "node:test";
import { InMemoryLlmBridge, McpBridgeLLMProvider } from "./bridge.js";
import { RecordingLLMProvider, ReplayLLMProvider, type Cassette } from "./cassette.js";
import type { CodeGenContext } from "./provider.js";

const ctx: CodeGenContext = { profile: { rowCount: 0, columns: [] }, dataframeVar: "df" };

test("bridge: a request blocks until a worker pulls and responds", async () => {
  const bridge = new InMemoryLlmBridge();
  const provider = new McpBridgeLLMProvider(bridge);

  // Provider blocks on generateCode...
  const pending = provider.generateCode("which city sells most?", ctx);

  // ...the worker sees the request with its grounding context...
  const req = await bridge.pull();
  assert.equal(req?.kind, "generateCode");
  assert.equal(req?.question, "which city sells most?");
  assert.equal(req?.dataframeVar, "df");

  // ...and responding resolves the provider's promise.
  await bridge.respond(req!.id, "print(df.city.value_counts().idxmax())");
  assert.equal(await pending, "print(df.city.value_counts().idxmax())");
});

test("bridge: pull waits when the queue is empty, then delivers", async () => {
  const bridge = new InMemoryLlmBridge();
  const provider = new McpBridgeLLMProvider(bridge);

  const pulled = bridge.pull(); // worker waiting first
  const answer = provider.interpret("q", "SF: 3");
  const req = await pulled;
  assert.equal(req?.kind, "interpret");
  assert.equal(req?.stdout, "SF: 3");
  await bridge.respond(req!.id, "SF leads with 3.");
  assert.equal(await answer, "SF leads with 3.");
});

test("cassette: record a run, then replay it deterministically without the model", async () => {
  const cassette: Cassette = {};
  const live: any = {
    async generateCode() { return "print('hi')"; },
    async interpret() { return "it said hi"; },
    async repairCode() { return "fixed"; },
  };
  const recording = new RecordingLLMProvider(live, cassette);
  await recording.generateCode("say hi", ctx);
  await recording.interpret("say hi", "hi\n");

  const replay = new ReplayLLMProvider(cassette);
  assert.equal(await replay.generateCode("say hi", ctx), "print('hi')");
  assert.equal(await replay.interpret("say hi", "hi\n"), "it said hi");

  await assert.rejects(() => replay.generateCode("unseen question", ctx), /cassette miss/);
});
