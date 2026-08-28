import { readFileSync } from "node:fs";
import { RedisLlmBridge } from "../index.js";

/**
 * The worker side of the bridge — how a model (Claude, here, or any MCP host)
 * answers the platform's LLM requests:
 *
 *   tsx src/cli/worker.ts pull [timeoutMs]      # take the next request, print it
 *   tsx src/cli/worker.ts respond <id> [file]   # deliver the answer (file or stdin)
 *
 * This is the exact surface the MCP tools `llm_pull_request` / `llm_submit_response`
 * wrap — the CLI just lets *this* Claude session act as the model right now.
 */

const redisUrl = process.env.REDIS_URL ?? "redis://localhost:6379";
const bridge = new RedisLlmBridge(redisUrl);

const [cmd, arg1, arg2] = process.argv.slice(2);

try {
  if (cmd === "pull") {
    const timeoutMs = arg1 ? Number(arg1) : 120_000;
    const req = await bridge.pull(timeoutMs);
    if (!req) {
      console.error("[worker] no request within timeout");
      process.exit(2);
    }
    console.log(JSON.stringify(req, null, 2));
  } else if (cmd === "respond") {
    if (!arg1) throw new Error("respond needs a request id");
    const text = arg2 ? readFileSync(arg2, "utf8") : readFileSync(0, "utf8"); // fd 0 = stdin
    await bridge.respond(arg1, text);
    console.error(`[worker] responded to ${arg1} (${text.length} chars)`);
  } else {
    console.error("usage: worker.ts pull [timeoutMs] | worker.ts respond <id> [file]");
    process.exit(1);
  }
} finally {
  await bridge.close();
}
