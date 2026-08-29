import assert from "node:assert/strict";
import { test } from "node:test";
import { E2BSandbox } from "./e2b.js";
import type { Storage } from "../storage/client.js";

/**
 * Integration test for the real E2B cloud sandbox. Runs actual sandboxes, so it
 * needs E2B_API_KEY; self-skips otherwise. Mirrors the Docker sandbox tests.
 */
const E2B_API_KEY = process.env.E2B_API_KEY;

// `city` repeats so it reads as categorical (an all-unique column is `string`).
const CSV = "city,sales\nSF,3.25\nNY,2.0\nSF,1.5\n";
const memStorage: Storage = {
  async put(k) { return k; },
  async read() { return new TextEncoder().encode(CSV); },
  async exists() { return true; },
};

function sandbox() {
  return new E2BSandbox({ apiKey: E2B_API_KEY, storage: memStorage, defaultTimeoutMs: 30_000 });
}

test("e2b: executes real Python and returns the computed value", { skip: !E2B_API_KEY }, async () => {
  const res = await sandbox().execute({
    datasetFile: "sales.csv",
    code: "print(df.loc[df.sales.idxmax(), 'city'])",
  });
  assert.equal(res.ok, true, res.stderr);
  assert.equal(res.stdout.trim(), "SF");
});

test("e2b: chart + result table come back as artifacts", { skip: !E2B_API_KEY }, async () => {
  const res = await sandbox().execute({
    datasetFile: "sales.csv",
    code: "df.plot.bar(x='city', y='sales')\nresult = df.sort_values('sales', ascending=False)",
  });
  assert.equal(res.ok, true, res.stderr);
  assert.ok(res.artifacts.some((a) => a.kind === "chart"), "chart artifact");
  const table = res.artifacts.find((a) => a.kind === "table");
  assert.ok(table && table.kind === "table" && table.columns.includes("sales"), "table artifact");
});

test("e2b: a crashing script returns a traceback, not a throw", { skip: !E2B_API_KEY }, async () => {
  const res = await sandbox().execute({ datasetFile: "sales.csv", code: "print(df['nope'])" });
  assert.equal(res.ok, false);
  assert.match(res.stderr, /KeyError|nope/);
});

test("e2b: the network is blocked (allowInternetAccess: false)", { skip: !E2B_API_KEY }, async () => {
  const res = await sandbox().execute({
    datasetFile: "sales.csv",
    code: "import urllib.request; urllib.request.urlopen('http://example.com', timeout=5)",
  });
  assert.equal(res.ok, false, "network call must fail");
  assert.match(res.stderr, /URLError|Network is unreachable|Errno|getaddrinfo|Temporary failure|timed out/i);
});

test("e2b: profiling reports shape and per-column types", { skip: !E2B_API_KEY }, async () => {
  const profile = await sandbox().profile("sales.csv");
  assert.equal(profile.rowCount, 3);
  const cols = Object.fromEntries(profile.columns.map((c) => [c.name, c.dtype]));
  assert.equal(cols.sales, "float");
  assert.equal(cols.city, "categorical");
});
