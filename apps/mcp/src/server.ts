import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createCoreServiceFromEnv, RedisLlmBridge } from "@julius/core";
import { createJuliusMcpServer } from "@julius/mcp-server";

/**
 * stdio entry point for the Julius-clone MCP server — for a local MCP host
 * (Claude Code's `.mcp.json`, the example agent) talking to a dev stack.
 *
 * The tools themselves live in `@julius/mcp-server`, shared with the HTTP
 * transport at `apps/web/app/api/mcp/route.ts`. This file owns exactly one
 * thing: wiring stdio to that surface. Everything analyst-shaped happens in the
 * core (`createCoreServiceFromEnv`), same as the web UI.
 *
 * It also exposes the LLM-worker tools, so an MCP host can BE the model when a
 * question isn't already answered by the seeded cassette — that needs a
 * long-lived process, which is why it belongs to stdio and not to serverless.
 */

const { service, repos } = createCoreServiceFromEnv();
const bridge = new RedisLlmBridge(process.env.REDIS_URL ?? "redis://localhost:6379");

const server = createJuliusMcpServer({ service: () => service, repos: () => repos, bridge });

const transport = new StdioServerTransport();
await server.connect(transport);
console.error("[mcp] julius-clone server up (analyst + llm-worker tools)");
