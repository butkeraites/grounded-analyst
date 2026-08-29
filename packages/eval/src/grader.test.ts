import assert from "node:assert/strict";
import { test } from "node:test";
import { ratio, scoreCorrectness, scoreFaithfulness } from "./grader.js";

test("correctness: normalizes $/commas and reports misses", () => {
  const s = scoreCorrectness(["North", 26990, 99999], "Total revenue: North $26,990");
  assert.equal(s.found, 2);
  assert.equal(s.total, 3);
  assert.deepEqual(s.missing, ["99999"]);
});

test("faithfulness: grounded data figures pass; derived percentages are excluded", () => {
  const s = scoreFaithfulness("North leads at $26,990 (55% share, a 24% lead).", "region North 26990");
  assert.equal(s.total, 1, "only the $26,990 figure is checked, not the percentages");
  assert.equal(s.grounded, 1);
  assert.deepEqual(s.ungrounded, []);
});

test("faithfulness: flags a fabricated data figure", () => {
  const s = scoreFaithfulness("Revenue was $99,999.", "North 26990");
  assert.equal(s.grounded, 0);
  assert.deepEqual(s.ungrounded, ["99999"]);
});

test("faithfulness: a sentence-ending period is not a decimal", () => {
  const s = scoreFaithfulness("The total was $12,150.", "product 12150");
  assert.equal(s.ungrounded.length, 0);
});

test("ratio is vacuously 1 when there is nothing to check", () => {
  assert.equal(ratio(0, 0), 1);
  assert.equal(ratio(3, 4), 0.75);
});
