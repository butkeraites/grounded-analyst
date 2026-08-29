import assert from "node:assert/strict";
import { chmodSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { after, before, test } from "node:test";
import { DockerSandbox } from "./docker.js";

/**
 * Integration tests for the real execution boundary. These run actual
 * containers, so they need Docker and the built sandbox image:
 *
 *   docker build -t julius-sandbox:latest ./sandbox
 *   npm test --workspace @julius/core
 *
 * They self-skip when Docker or the image is unavailable, so the suite still
 * passes in environments without them.
 */

function dockerReady(): boolean {
  try {
    execFileSync("docker", ["image", "inspect", "julius-sandbox:latest"], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

const READY = dockerReady();
let dir = "";
// `city` repeats so it reads as categorical (an all-unique column is `string`).
const CSV = "city,sales\nSF,3.25\nNY,2.0\nSF,1.5\n";

before(() => {
  if (!READY) return;
  dir = mkdtempSync(join(tmpdir(), "julius-sbx-"));
  writeFileSync(join(dir, "sales.csv"), CSV);
  // The sandbox runs as an unprivileged user; make the dir + file readable to it
  // (mkdtemp is 700 on Linux, which would block uid 65534).
  chmodSync(dir, 0o755);
  chmodSync(join(dir, "sales.csv"), 0o644);
});

function sandbox() {
  return new DockerSandbox({ datasetsMount: dir, image: "julius-sandbox:latest", defaultTimeoutMs: 20_000 });
}

test("executes real Python over the dataframe and returns the computed value", { skip: !READY }, async () => {
  const res = await sandbox().execute({
    datasetFile: "sales.csv",
    code: "print(df.loc[df.sales.idxmax(), 'city'])",
  });
  assert.equal(res.ok, true, res.stderr);
  assert.equal(res.stdout.trim(), "SF");
});

test("produces a chart artifact when the code plots", { skip: !READY }, async () => {
  const res = await sandbox().execute({
    datasetFile: "sales.csv",
    code: "df.plot.bar(x='city', y='sales')",
  });
  assert.equal(res.ok, true, res.stderr);
  const chart = res.artifacts.find((a) => a.kind === "chart");
  assert.ok(chart, "a chart artifact is returned");
  assert.equal(chart!.kind === "chart" && chart.mimeType, "image/png");
});

test("a `result` DataFrame comes back as a structured table", { skip: !READY }, async () => {
  const res = await sandbox().execute({
    datasetFile: "sales.csv",
    code: "result = df.sort_values('sales', ascending=False)",
  });
  assert.equal(res.ok, true, res.stderr);
  const table = res.artifacts.find((a) => a.kind === "table");
  assert.ok(table && table.kind === "table");
  assert.deepEqual(table.columns, ["city", "sales"]);
  assert.equal(table.rows[0]?.[0], "SF", "sorted rows preserved");
});

test("a crashing script returns a traceback, not a thrown error", { skip: !READY }, async () => {
  const res = await sandbox().execute({
    datasetFile: "sales.csv",
    code: "print(df['nonexistent_column'])",
  });
  assert.equal(res.ok, false);
  assert.match(res.stderr, /KeyError|nonexistent_column/);
});

test("the network is unreachable inside the sandbox", { skip: !READY }, async () => {
  const res = await sandbox().execute({
    datasetFile: "sales.csv",
    code: "import urllib.request; urllib.request.urlopen('http://example.com', timeout=5)",
  });
  assert.equal(res.ok, false, "network call must fail");
  assert.match(res.stderr, /URLError|Network is unreachable|Errno|getaddrinfo|Temporary failure/i);
});

test("a run exceeding the timeout is killed", { skip: !READY }, async () => {
  const res = await new DockerSandbox({ datasetsMount: dir, image: "julius-sandbox:latest" }).execute({
    datasetFile: "sales.csv",
    code: "while True: pass",
    timeoutMs: 3_000,
  });
  assert.equal(res.timedOut, true);
  assert.equal(res.ok, false);
});

test("profiling reports shape and per-column types", { skip: !READY }, async () => {
  const profile = await sandbox().profile("sales.csv");
  assert.equal(profile.rowCount, 3);
  const cols = Object.fromEntries(profile.columns.map((c) => [c.name, c.dtype]));
  assert.equal(cols.sales, "float");
  assert.equal(cols.city, "categorical");
});

after(() => {
  // Temp dir is left for the OS to reap; nothing else to tear down (--rm).
});
