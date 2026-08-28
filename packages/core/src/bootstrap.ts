import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { createCoreService, type CoreService } from "./service.js";
import { getDb } from "./db/client.js";
import { makeRepositories, type Repositories } from "./db/repositories.js";
import { LocalStorage } from "./storage/local.js";
import { PostgresStorage } from "./storage/postgres.js";
import { DockerSandbox } from "./sandbox/docker.js";
import { E2BSandbox } from "./sandbox/e2b.js";
import type { SandboxClient, Profiler } from "./sandbox/client.js";
import { RedisLlmBridge } from "./llm/redis-bridge.js";
import { McpBridgeLLMProvider } from "./llm/bridge.js";
import { CompositeLLMProvider } from "./llm/composite.js";
import { ReplayLLMProvider } from "./llm/cassette.js";
import { loadCassette } from "./llm/cassette.js";
import { resolveLLMConfig, resolveProvider, type LLMProvider } from "./llm/provider.js";
import type { Storage } from "./storage/client.js";

/**
 * Convenience wiring so EVERY client builds the exact same core from the same
 * env — the concrete proof of "one core, many clients". `createCoreService`
 * itself stays env-agnostic; this is the opt-in bootstrap the web app and the
 * MCP server both call, so neither reimplements adapter wiring.
 *
 * LLM strategy: replay a cassette first (seeded demo answers with no model),
 * fall back to the MCP bridge (Claude/an agent powering it live).
 */

export interface Bootstrapped {
  service: CoreService;
  repos: Repositories;
  storage: Storage;
}

const NO_MODEL_MESSAGE =
  "No model is configured for questions outside the sample set. Set LLM_BASE_URL/LLM_MODEL " +
  "(e.g. a local Ollama or a Groq endpoint) to enable them.";
const noModelConfigured: LLMProvider = {
  async generateCode() {
    throw new Error(NO_MODEL_MESSAGE);
  },
  async repairCode() {
    throw new Error(NO_MODEL_MESSAGE);
  },
  async interpret() {
    throw new Error(NO_MODEL_MESSAGE);
  },
};

function required(env: NodeJS.ProcessEnv, name: string): string {
  const v = env[name];
  if (!v) throw new Error(`${name} is not set`);
  return v;
}

export function createCoreServiceFromEnv(env: NodeJS.ProcessEnv = process.env): Bootstrapped {
  const db = getDb(required(env, "DATABASE_URL"));
  const repos = makeRepositories(db);

  // Prod (serverless) vs dev, chosen by whether E2B is configured:
  //   E2B set  -> Postgres-backed storage + E2B cloud sandbox (no Docker, no disk)
  //   otherwise-> local disk storage + local Docker sandbox
  let storage: Storage;
  let sandbox: SandboxClient & Profiler;
  if (env.E2B_API_KEY) {
    storage = new PostgresStorage(db);
    sandbox = new E2BSandbox({ apiKey: env.E2B_API_KEY, storage });
  } else {
    const datasetsDir = resolve(env.DATASETS_DIR ?? "./.data");
    storage = new LocalStorage(datasetsDir);
    sandbox = new DockerSandbox({
      datasetsMount: env.SANDBOX_DATASETS_MOUNT ?? datasetsDir,
      image: env.SANDBOX_IMAGE ?? "grounded-sandbox:latest",
    });
  }

  const buildLLM = (): LLMProvider => {
    // The fallback for questions the cassette doesn't cover, in preference order:
    //   LLM_BASE_URL -> a real BYO-LLM (openai-compatible: Ollama, Groq, …)
    //   REDIS_URL    -> the MCP bridge (an agent powering the platform live)
    //   neither      -> a clear "no model configured" error (seeded questions
    //                   still work from the cassette; arbitrary ones say why)
    let fallback: LLMProvider;
    if (env.LLM_BASE_URL) {
      fallback = resolveProvider(
        resolveLLMConfig({
          kind: "openai-compatible",
          baseUrl: env.LLM_BASE_URL,
          apiKey: env.LLM_API_KEY,
          model: env.LLM_MODEL,
        }),
      );
    } else if (env.REDIS_URL) {
      const requestTimeoutMs = env.LLM_BRIDGE_TIMEOUT_MS ? Number(env.LLM_BRIDGE_TIMEOUT_MS) : undefined;
      fallback = new McpBridgeLLMProvider(new RedisLlmBridge(env.REDIS_URL, { requestTimeoutMs }));
    } else {
      fallback = noModelConfigured;
    }

    const cassettePath = env.CASSETTE_PATH;
    if (cassettePath && existsSync(cassettePath)) {
      return new CompositeLLMProvider(new ReplayLLMProvider(loadCassette(cassettePath)), fallback);
    }
    return fallback;
  };

  const service = createCoreService({
    repos,
    storage,
    sandbox,
    profiler: sandbox,
    llm: () => buildLLM(),
  });

  return { service, repos, storage };
}
