import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { test } from "node:test";
import { createCoreService } from "./service.js";
import { DockerSandbox } from "./sandbox/docker.js";
import { LocalStorage } from "./storage/local.js";
import { getDb, closeDb } from "./db/client.js";
import { makeRepositories } from "./db/repositories.js";

/**
 * End-to-end integration of the callable core over the REAL sandbox + storage +
 * database: `upload` stores bytes and profiles them in a container; `analyze`
 * would then run generated code (LLM is faked here — no provider is wired yet).
 *
 * Needs Docker + the sandbox image + a migrated Postgres; self-skips otherwise.
 */

const DATABASE_URL = process.env.DATABASE_URL;
function dockerReady(): boolean {
  try {
    execFileSync("docker", ["image", "inspect", "julius-sandbox:latest"], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}
const READY = Boolean(DATABASE_URL) && dockerReady();

test("upload: stores, profiles in the sandbox, and persists the dataset", { skip: !READY }, async () => {
  const dir = mkdtempSync(join(tmpdir(), "julius-svc-"));
  const repos = makeRepositories(getDb(DATABASE_URL!));
  const service = createCoreService({
    repos,
    storage: new LocalStorage(dir),
    sandbox: new DockerSandbox({ datasetsMount: dir, image: "julius-sandbox:latest" }),
    profiler: new DockerSandbox({ datasetsMount: dir, image: "julius-sandbox:latest" }),
    llm: () => {
      throw new Error("LLM not wired in this test");
    },
  });

  const csv = "region,revenue\nnorth,100\nsouth,250\nnorth,175\n";
  const dataset = await service.upload({
    name: "revenue.csv",
    contentType: "text/csv",
    bytes: new TextEncoder().encode(csv),
  });

  assert.ok(dataset.id);
  assert.equal(dataset.profile.rowCount, 3);
  const region = dataset.profile.columns.find((c) => c.name === "region");
  assert.equal(region?.dtype, "categorical");
  const revenue = dataset.profile.columns.find((c) => c.name === "revenue");
  assert.equal(revenue?.dtype, "integer");

  // It really landed in Postgres.
  const fetched = await repos.datasets.get(dataset.id);
  assert.equal(fetched?.name, "revenue.csv");
  assert.equal(fetched?.storageKey, dataset.storageKey);

  await closeDb();
});
