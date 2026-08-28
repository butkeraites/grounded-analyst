/**
 * Public surface of the core analyst service.
 *
 * Every client — the web UI today, the MCP server later — imports from here
 * and nowhere deeper. Keeping the surface explicit is what keeps the "one core,
 * two clients" seam honest.
 */

export * from "./types.js";
export * from "./llm/provider.js";
export { NotImplementedError } from "./errors.js";

// "Claude-as-the-LLM" bridge + record/replay — both are LLMProvider adapters.
export {
  McpBridgeLLMProvider,
  InMemoryLlmBridge,
  type LlmBridge,
  type LlmRequest,
  type LlmRequestKind,
} from "./llm/bridge.js";
export { RedisLlmBridge } from "./llm/redis-bridge.js";
export {
  RecordingLLMProvider,
  ReplayLLMProvider,
  loadCassette,
  saveCassette,
  type Cassette,
} from "./llm/cassette.js";

// The callable core service — what both clients construct and call into.
export {
  createCoreService,
  type CoreService,
  type CoreDeps,
  type LLMResolver,
  type AnalyzePhase,
  type AnalyzeHooks,
} from "./service.js";
export { CompositeLLMProvider } from "./llm/composite.js";
export { createCoreServiceFromEnv, type Bootstrapped } from "./bootstrap.js";

// Execution tier (ports + the Docker adapter).
export type {
  SandboxClient,
  Profiler,
  ExecutionRequest,
  ExecutionResult,
} from "./sandbox/client.js";
export { DockerSandbox, type DockerSandboxOptions } from "./sandbox/docker.js";

// Storage port + local adapter.
export type { Storage } from "./storage/client.js";
export { LocalStorage } from "./storage/local.js";

// Persistence layer — owned by the core so both clients share one schema.
export { getDb, pingDb, closeDb, type Db } from "./db/client.js";
export {
  makeRepositories,
  type Repositories,
  type DatasetRepo,
  type ConversationRepo,
  type MessageRepo,
  type RunRepo,
  type NewDataset,
  type RunCompletion,
} from "./db/repositories.js";
export type { DatasetRow, ConversationRow, MessageRow, RunRow } from "./db/schema.js";
