import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";

// Resolve from the repo root regardless of the cwd npm chose for the workspace.
const repoRoot = fileURLToPath(new URL("../../..", import.meta.url));

/**
 * Living proof: an external agent piloting the whole platform via MCP, with no
 * human in the loop. It spawns the julius-clone MCP server and drives a full
 * analysis end-to-end — upload → ask → pull back the code, the table, and the
 * chart — the thing Julius itself doesn't expose.
 *
 * Two ways to run it, over the same tools:
 *
 *   # against the LIVE deployment, over Streamable HTTP — nothing to install
 *   MCP_URL=https://<deployment>/api/mcp MCP_TOKEN=<token> npm run agent --workspace mcp
 *
 *   # against a local stack, over stdio
 *   docker compose up -d postgres redis && docker compose run --rm migrate
 *   docker build -t julius-sandbox:latest ./sandbox
 *   npm run agent --workspace mcp        # (or: tsx apps/mcp/src/example-agent.ts)
 *
 * The script below doesn't branch after the transport is chosen: an agent
 * piloting the deployment and an agent piloting a laptop see one tool surface.
 */

const cleanEnv = Object.fromEntries(
  Object.entries({
    ...process.env,
    DATABASE_URL: process.env.DATABASE_URL ?? "postgres://julius:julius@localhost:5432/julius",
    REDIS_URL: process.env.REDIS_URL ?? "redis://localhost:6379",
    DATASETS_DIR: process.env.DATASETS_DIR ?? "./.data",
    SANDBOX_IMAGE: process.env.SANDBOX_IMAGE ?? "julius-sandbox:latest",
    CASSETTE_PATH: process.env.CASSETTE_PATH ?? "seed/cassette.sales.json",
  }).filter(([, v]) => v !== undefined),
) as Record<string, string>;

function chooseTransport(): { transport: Transport; label: string } {
  const url = process.env.MCP_URL;
  if (!url) {
    return {
      label: "stdio (local stack)",
      transport: new StdioClientTransport({
        command: "npx",
        args: ["tsx", "apps/mcp/src/server.ts"],
        cwd: repoRoot,
        env: cleanEnv,
      }),
    };
  }
  // MCP_TOKEN is the deployment's bearer credential; SITE_PASSWORD works too,
  // since the endpoint accepts the same Basic credential that gates the web app.
  const token = process.env.MCP_TOKEN;
  const sitePassword = process.env.SITE_PASSWORD;
  const authorization = token
    ? `Bearer ${token}`
    : sitePassword
      ? `Basic ${Buffer.from(`${process.env.SITE_USER ?? "julius"}:${sitePassword}`).toString("base64")}`
      : undefined;
  return {
    label: `streamable http (${url})`,
    transport: new StreamableHTTPClientTransport(new URL(url), {
      requestInit: authorization ? { headers: { authorization } } : undefined,
    }),
  };
}

const { transport, label } = chooseTransport();

const client = new Client({ name: "example-agent", version: "0.1.0" });

const firstText = (result: { content: Array<{ type: string; text?: string }> }) =>
  result.content.find((c) => c.type === "text")?.text ?? "";

async function main() {
  await client.connect(transport);
  const { tools } = await client.listTools();
  console.log(`Connected over ${label}.`);
  console.log(`Tools: ${tools.map((t) => t.name).join(", ")}\n`);

  console.log("→ upload_dataset(sales.csv)");
  const csv = readFileSync(join(repoRoot, "seed", "sales.csv"), "utf8");
  const up = await client.callTool({ name: "upload_dataset", arguments: { name: "sales.csv", content: csv } });
  const dataset = JSON.parse(firstText(up as never));
  console.log(`  dataset ${dataset.datasetId}: ${dataset.rows} rows, ${dataset.columns.length} columns\n`);

  const question = "Which region generates the most revenue, and how does it break down by product?";
  console.log(`→ run_analysis("${question}")`);
  const ran = await client.callTool({
    name: "run_analysis",
    arguments: { datasetId: dataset.datasetId, question },
  });
  const analysis = JSON.parse(firstText(ran as never));
  console.log(`  interpretation: ${analysis.interpretation}`);
  console.log(`  artifacts: ${analysis.artifacts.join(", ")} · runId ${analysis.runId}\n`);

  console.log("→ get_code(runId)");
  const code = await client.callTool({ name: "get_code", arguments: { runId: analysis.runId } });
  console.log(
    firstText(code as never)
      .split("\n")
      .slice(0, 3)
      .map((l) => `  ${l}`)
      .join("\n") + "\n  …\n",
  );

  console.log("→ get_table(runId)");
  const table = JSON.parse(firstText(await client.callTool({ name: "get_table", arguments: { runId: analysis.runId } }) as never));
  console.log(`  columns: ${table.columns?.join(", ")} · ${table.rows?.length} rows\n`);

  console.log("→ get_chart(runId)");
  const chart = (await client.callTool({ name: "get_chart", arguments: { runId: analysis.runId } })) as {
    content: Array<{ type: string; data?: string; mimeType?: string }>;
  };
  const img = chart.content.find((c) => c.type === "image");
  console.log(`  received ${img?.mimeType} chart (${Math.round((img?.data?.length ?? 0) * 0.75)} bytes)\n`);

  console.log("✓ The agent uploaded a dataset, asked a question, and pulled back the interpretation,");
  console.log("  the generated Python, the result table, and the chart — entirely over MCP.");

  await client.close();
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
