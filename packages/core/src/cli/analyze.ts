import { readFileSync } from "node:fs";
import { basename } from "node:path";
import {
  createCoreService,
  DockerSandbox,
  LocalStorage,
  makeRepositories,
  getDb,
  closeDb,
  McpBridgeLLMProvider,
  RedisLlmBridge,
  RecordingLLMProvider,
  saveCassette,
  loadCassette,
  type Cassette,
} from "../index.js";
import { existsSync } from "node:fs";

/**
 * Headless driver for the core, wired with REAL adapters. It runs the full
 * analyze loop where the LLM is whatever worker is servicing the Redis bridge —
 * i.e. Claude acting as the platform's model. Optionally records a cassette.
 *
 *   DATABASE_URL=... REDIS_URL=... DATASETS_DIR=./.data \
 *     tsx src/cli/analyze.ts <csvPath> "<question>" [--record cassette.json]
 */

const [csvPath, question, ...rest] = process.argv.slice(2);
if (!csvPath || !question) {
  console.error('usage: analyze.ts <csvPath> "<question>" [--record <file>]');
  process.exit(1);
}
const recordIdx = rest.indexOf("--record");
const recordPath = recordIdx >= 0 ? rest[recordIdx + 1] : undefined;

const datasetsDir = process.env.DATASETS_DIR ?? "./.data";
const databaseUrl = process.env.DATABASE_URL ?? "postgres://julius:julius@localhost:5432/julius";
const redisUrl = process.env.REDIS_URL ?? "redis://localhost:6379";
const image = process.env.SANDBOX_IMAGE ?? "julius-sandbox:latest";

const storage = new LocalStorage(datasetsDir);
const sandbox = new DockerSandbox({ datasetsMount: datasetsDir, image });
const bridge = new RedisLlmBridge(redisUrl);
// Merge into an existing cassette so multiple questions accumulate.
const cassette: Cassette = recordPath && existsSync(recordPath) ? loadCassette(recordPath) : {};
const baseProvider = new McpBridgeLLMProvider(bridge);
const provider = recordPath ? new RecordingLLMProvider(baseProvider, cassette) : baseProvider;

const service = createCoreService({
  repos: makeRepositories(getDb(databaseUrl)),
  storage,
  sandbox,
  profiler: sandbox,
  llm: () => provider,
});

try {
  const bytes = new Uint8Array(readFileSync(csvPath));
  console.error(`[analyze] uploading ${csvPath} (${bytes.byteLength} bytes) …`);
  const dataset = await service.upload({ name: basename(csvPath), contentType: "text/csv", bytes });
  console.error(`[analyze] dataset ${dataset.id}: ${dataset.profile.rowCount} rows, columns:`);
  for (const c of dataset.profile.columns) console.error(`  - ${c.name} (${c.dtype})`);
  console.error(`[analyze] asking: ${question}`);
  console.error(`[analyze] waiting for the model on the bridge …\n`);

  const result = await service.analyze({ datasetId: dataset.id, question });

  console.log(JSON.stringify(
    {
      interpretation: result.interpretation,
      code: result.execution.code,
      stdout: result.execution.stdout,
      repairAttempts: result.execution.repairAttempts,
      artifacts: result.artifacts.map((a) => (a.kind === "chart" ? { kind: a.kind, mimeType: a.mimeType, bytes: a.data.length } : { kind: a.kind, columns: a.columns, rows: a.rows.length })),
    },
    null,
    2,
  ));

  if (recordPath) {
    saveCassette(recordPath, cassette);
    console.error(`\n[analyze] recorded cassette -> ${recordPath}`);
  }
} finally {
  await bridge.close();
  await closeDb();
}
