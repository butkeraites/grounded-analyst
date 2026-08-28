import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { createCoreService, type CoreService } from "./service.js";
import { getDb } from "./db/client.js";
import { makeRepositories, type Repositories } from "./db/repositories.js";
import { LocalStorage } from "./storage/local.js";
import { DockerSandbox } from "./sandbox/docker.js";
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

function required(env: NodeJS.ProcessEnv, name: string): string {
  const v = env[name];
  if (!v) throw new Error(`${name} is not set`);
  return v;
}

export function createCoreServiceFromEnv(env: NodeJS.ProcessEnv = process.env): Bootstrapped {
  // Absolute so a host-run sandbox can bind-mount it (docker -v needs an
  // absolute path or a named volume, never a relative path).
  const datasetsDir = resolve(env.DATASETS_DIR ?? "./.data");
  const storage = new LocalStorage(datasetsDir);
  const sandbox = new DockerSandbox({
    datasetsMount: env.SANDBOX_DATASETS_MOUNT ?? datasetsDir,
    image: env.SANDBOX_IMAGE ?? "grounded-sandbox:latest",
  });
  const repos = makeRepositories(getDb(required(env, "DATABASE_URL")));

  const buildLLM = (): LLMProvider => {
    // The fallback for questions the cassette doesn't cover: a real BYO-LLM
    // (openai-compatible, e.g. local Ollama) when configured, otherwise the
    // MCP bridge (an agent powering the platform live).
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
    } else {
      const requestTimeoutMs = env.LLM_BRIDGE_TIMEOUT_MS ? Number(env.LLM_BRIDGE_TIMEOUT_MS) : undefined;
      fallback = new McpBridgeLLMProvider(new RedisLlmBridge(required(env, "REDIS_URL"), { requestTimeoutMs }));
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
