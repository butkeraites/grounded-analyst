import { readFileSync } from "node:fs";
import { basename, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createCoreServiceFromEnv, closeDb, type Artifact } from "@julius/core";
import { ratio, scoreCorrectness, scoreFaithfulness } from "./grader.js";

/**
 * The analyst eval. For each golden case it runs the REAL loop (code-gen →
 * sandbox execute → interpret) and scores execution-based correctness and
 * grounding faithfulness, then prints a scorecard and exits non-zero below
 * threshold — a regression gate you can wire into CI.
 *
 * Modes (by env): if LLM_BASE_URL is set → LIVE (real model, e.g. Groq) — costs
 * quota, run manually. Otherwise → CASSETTE (recorded output + local Docker
 * sandbox) — deterministic and $0, used as the CI gate.
 */

const CORRECTNESS_MIN = 0.9;
const FAITHFULNESS_MIN = 0.9;

const repoRoot = fileURLToPath(new URL("../../..", import.meta.url));
const casesPath = fileURLToPath(new URL("../golden/cases.json", import.meta.url));

process.env.DATABASE_URL ??= "postgres://julius:julius@localhost:5432/julius";
process.env.SANDBOX_IMAGE ??= "julius-sandbox:latest";
process.env.DATASETS_DIR ??= join(repoRoot, ".data/eval");
if (process.env.LLM_BASE_URL) {
  delete process.env.CASSETTE_PATH; // LIVE: score the real model, no cassette shortcut
} else {
  process.env.CASSETTE_PATH ??= join(repoRoot, "seed", "cassette.sales.json");
}

interface Case {
  id: string;
  csv: string;
  question: string;
  expect: { values: Array<string | number>; artifacts?: string[] };
}

function flattenExecuted(stdout: string, artifacts: Artifact[]): string {
  const tables = artifacts
    .filter((a): a is Extract<Artifact, { kind: "table" }> => a.kind === "table")
    .map((t) => `${t.columns.join(" ")} ${t.rows.map((r) => r.join(" ")).join(" ")}`)
    .join(" ");
  return `${stdout} ${tables}`;
}

async function main() {
  const cases: Case[] = JSON.parse(readFileSync(casesPath, "utf8"));
  const mode = process.env.LLM_BASE_URL ? `live (${process.env.LLM_MODEL})` : "cassette";
  console.log(`\nAnalyst eval — ${cases.length} cases · mode: ${mode}\n`);

  const { service } = createCoreServiceFromEnv();
  const rows: Array<{ id: string; corr: number; faith: number; valid: boolean; repairs: number; notes: string }> = [];

  for (const c of cases) {
    const csv = readFileSync(join(repoRoot, c.csv), "utf8");
    let corr = 0;
    let faith = 0;
    let valid = false;
    let repairs = 0;
    let notes = "";
    try {
      const ds = await service.upload({ name: basename(c.csv), contentType: "text/csv", bytes: new TextEncoder().encode(csv) });
      const r = await service.analyze({ datasetId: ds.id, question: c.question });
      valid = true;
      repairs = r.execution.repairAttempts;
      const executed = flattenExecuted(r.execution.stdout, r.artifacts);
      const correctness = scoreCorrectness(c.expect.values, executed);
      const faithfulness = scoreFaithfulness(r.interpretation, executed);
      corr = ratio(correctness.found, correctness.total);
      faith = ratio(faithfulness.grounded, faithfulness.total);
      const artifactsOk = (c.expect.artifacts ?? []).every((k) => r.artifacts.some((a) => a.kind === k));
      const bits: string[] = [];
      if (correctness.missing.length) bits.push(`missing: ${correctness.missing.join(",")}`);
      if (faithfulness.ungrounded.length) bits.push(`ungrounded: ${faithfulness.ungrounded.join(",")}`);
      if (!artifactsOk) bits.push("artifacts missing");
      notes = bits.join(" · ");
    } catch (err) {
      notes = `FAILED: ${err instanceof Error ? err.message.slice(0, 60) : String(err)}`;
    }
    rows.push({ id: c.id, corr, faith, valid, repairs, notes });
    const pct = (n: number) => `${Math.round(n * 100)}%`;
    console.log(`  ${valid ? "✓" : "✗"} ${c.id.padEnd(20)} correctness ${pct(corr)}  faithfulness ${pct(faith)}  repairs ${repairs}${notes ? `  — ${notes}` : ""}`);
  }

  const avg = (f: (r: (typeof rows)[number]) => number) => rows.reduce((a, r) => a + f(r), 0) / rows.length;
  const aggCorr = avg((r) => r.corr);
  const aggFaith = avg((r) => r.faith);
  console.log(`\nAggregate — correctness ${Math.round(aggCorr * 100)}% · faithfulness ${Math.round(aggFaith * 100)}% · valid ${rows.filter((r) => r.valid).length}/${rows.length}`);
  console.log(`Thresholds — correctness ≥ ${CORRECTNESS_MIN * 100}% · faithfulness ≥ ${FAITHFULNESS_MIN * 100}%\n`);

  await closeDb();
  if (aggCorr < CORRECTNESS_MIN || aggFaith < FAITHFULNESS_MIN || rows.some((r) => !r.valid)) {
    console.error("EVAL FAILED — below threshold.\n");
    process.exit(1);
  }
  console.log("EVAL PASSED.\n");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
