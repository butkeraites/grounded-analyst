import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

// Resolve from the repo root regardless of the cwd npm chose for the workspace.
const repoRoot = fileURLToPath(new URL("../../..", import.meta.url));

/**
 * Living proof: an external agent piloting the whole platform via MCP, with no
 * human in the loop. It spawns the grounded-analyst MCP server and drives a full
 * analysis end-to-end — upload → ask → pull back the code, the table, and the
 * chart — the thing Grounded itself doesn't expose.
 *
 *   docker compose up -d postgres redis && docker compose run --rm migrate
 *   docker build -t grounded-sandbox:latest ./sandbox
 *   npm run agent --workspace mcp        # (or: tsx apps/mcp/src/example-agent.ts)
 */

const cleanEnv = Object.fromEntries(
  Object.entries({
    ...process.env,
    DATABASE_URL: process.env.DATABASE_URL ?? "postgres://grounded:grounded@localhost:5432/grounded",
    REDIS_URL: process.env.REDIS_URL ?? "redis://localhost:6379",
    DATASETS_DIR: process.env.DATASETS_DIR ?? "./.data",
    SANDBOX_IMAGE: process.env.SANDBOX_IMAGE ?? "grounded-sandbox:latest",
    CASSETTE_PATH: process.env.CASSETTE_PATH ?? "seed/cassette.sales.json",
  }).filter(([, v]) => v !== undefined),
) as Record<string, string>;

const transport = new StdioClientTransport({
  command: "npx",
  args: ["tsx", "apps/mcp/src/server.ts"],
  cwd: repoRoot,
  env: cleanEnv,
});

const client = new Client({ name: "example-agent", version: "0.1.0" });

const firstText = (result: { content: Array<{ type: string; text?: string }> }) =>
  result.content.find((c) => c.type === "text")?.text ?? "";

async function main() {
  await client.connect(transport);
  const { tools } = await client.listTools();
  console.log(`Connected. Tools: ${tools.map((t) => t.name).join(", ")}\n`);

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
