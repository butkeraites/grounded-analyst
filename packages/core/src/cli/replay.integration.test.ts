import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { test } from "node:test";
import { createCoreService } from "../service.js";
import { DockerSandbox } from "../sandbox/docker.js";
import { LocalStorage } from "../storage/local.js";
import { ReplayLLMProvider, loadCassette } from "../llm/cassette.js";
import { getDb, closeDb } from "../db/client.js";
import { makeRepositories } from "../db/repositories.js";

/**
 * The seeded demo, running WITHOUT any model attached: the cassette recorded
 * while Claude powered the bridge replays deterministically. The generated code
 * re-executes in the real sandbox (same data -> same stdout -> the interpret
 * key still matches), proving the public URL never depends on a live model.
 */

const CSV = fileURLToPath(new URL("../../../../seed/sales.csv", import.meta.url));
const CASSETTE = fileURLToPath(new URL("../../../../seed/cassette.sales.json", import.meta.url));
const QUESTION = "Which region generates the most revenue, and how does it break down by product?";

const DATABASE_URL = process.env.DATABASE_URL;
function dockerReady(): boolean {
  try {
    execFileSync("docker", ["image", "inspect", "julius-sandbox:latest"], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}
const READY = Boolean(DATABASE_URL) && dockerReady() && existsSync(CASSETTE);

test("replay: the recorded cassette drives the full loop, no model attached", { skip: !READY }, async () => {
  const dir = mkdtempSync(join(tmpdir(), "julius-replay-"));
  const sandbox = new DockerSandbox({ datasetsMount: dir, image: "julius-sandbox:latest" });
  const service = createCoreService({
    repos: makeRepositories(getDb(DATABASE_URL!)),
    storage: new LocalStorage(dir),
    sandbox,
    profiler: sandbox,
    llm: () => new ReplayLLMProvider(loadCassette(CASSETTE)),
  });

  const dataset = await service.upload({
    name: "sales.csv",
    contentType: "text/csv",
    bytes: new Uint8Array(readFileSync(CSV)),
  });
  const result = await service.analyze({ datasetId: dataset.id, question: QUESTION });

  assert.equal(result.execution.repairAttempts, 0);
  assert.match(result.execution.stdout, /North\s+26990/, "code really ran over the data");
  assert.match(result.interpretation, /North is the top-revenue region/);
  assert.ok(result.artifacts.some((a) => a.kind === "chart"), "chart artifact produced");
  assert.ok(result.artifacts.some((a) => a.kind === "table"), "table artifact produced");

  await closeDb();
});
