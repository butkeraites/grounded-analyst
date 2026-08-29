/**
 * Grading for the analyst eval. Two metrics that matter for an AI data analyst:
 *
 * - Correctness (execution-based): do the expected values actually appear in the
 *   EXECUTED output (stdout + result table)? This checks the generated code
 *   computed the right thing over the real data — not that the model sounded right.
 * - Faithfulness (grounding): is every substantive number in the written
 *   interpretation present in the executed output? This is the "never fabricate"
 *   property, measured — the metric a serious AI-analyst product lives on.
 */

/** Normalise so "$26,990" and "26990" compare equal. */
const norm = (s: string) => s.replace(/[$,%\s]/g, "").toLowerCase();

export interface CorrectnessScore {
  found: number;
  total: number;
  missing: string[];
}

export function scoreCorrectness(expected: Array<string | number>, executed: string): CorrectnessScore {
  const hay = norm(executed);
  const missing: string[] = [];
  let found = 0;
  for (const e of expected) {
    if (hay.includes(norm(String(e)))) found += 1;
    else missing.push(String(e));
  }
  return { found, total: expected.length, missing };
}

/**
 * "Substantive" DATA figures only: numbers with >= 3 significant digits that are
 * NOT percentages. Percentages (e.g. "a 24% lead", "45.2%") are derived/rounded
 * commentary a model computes from grounded figures — requiring them verbatim in
 * stdout would be pedantic. This keeps faithfulness meaningful: it asks whether
 * the actual data values cited were produced by the code, not whether every
 * derived stat was pre-printed.
 */
function substantiveNumbers(text: string): string[] {
  const re = /\$?(\d[\d,]*\.?\d*)(%?)/g;
  const out: string[] = [];
  for (let m = re.exec(text); m; m = re.exec(text)) {
    if (m[2] === "%") continue; // derived percentage — not a raw data figure
    const n = m[1]!.replace(/[$,]/g, "").replace(/\.$/, ""); // drop sentence-ending "."
    if (n.replace(/\D/g, "").length >= 3) out.push(n);
  }
  return out;
}

export interface FaithfulnessScore {
  grounded: number;
  total: number;
  ungrounded: string[];
}

export function scoreFaithfulness(interpretation: string, executed: string): FaithfulnessScore {
  const hay = norm(executed);
  const nums = substantiveNumbers(interpretation);
  const ungrounded: string[] = [];
  let grounded = 0;
  for (const n of nums) {
    if (hay.includes(norm(n))) grounded += 1;
    else ungrounded.push(n);
  }
  return { grounded, total: nums.length, ungrounded };
}

/** ratio helper: 1.0 when there is nothing to check (vacuously true). */
export const ratio = (num: number, den: number) => (den === 0 ? 1 : num / den);
