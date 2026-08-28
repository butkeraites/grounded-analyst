import { readFile } from "node:fs/promises";
import { NextResponse } from "next/server";
import { getService, datasetsStorage } from "@/lib/core";
import { repositories } from "@/lib/db";
import { seedFile } from "@/lib/paths";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SEED_NAME = "sales.csv";

// Curated starter questions for the sample dataset — recorded in the cassette so
// the live demo answers each one instantly with no model attached.
const SEED_SUGGESTIONS = [
  "Which region generates the most revenue, and how does it break down by product?",
  "How do monthly revenue trends compare between North and South?",
  "Which product drives more revenue overall, Widget or Gadget?",
];

/**
 * Ensures the seeded sample dataset exists, so the live URL demos in one click.
 * Idempotent: returns the existing seed if already loaded, else uploads it.
 */
export async function GET() {
  const service = getService();
  const storage = datasetsStorage();

  // Pick the most recent sales.csv whose file still lives in THIS deployment's
  // store (avoids datasets created elsewhere, e.g. by CLI recordings, whose
  // bytes aren't in the sandbox's volume). Upload fresh if none qualifies.
  const candidates = (await repositories().datasets.list()).filter((d) => d.name === SEED_NAME);
  let dataset = null;
  for (const c of candidates) {
    if (await storage.exists(c.storageKey)) {
      dataset = c;
      break;
    }
  }
  dataset ??= await service.upload({
    name: SEED_NAME,
    contentType: "text/csv",
    bytes: new Uint8Array(await readFile(seedFile(SEED_NAME))),
  });
  return NextResponse.json({ dataset, suggestions: SEED_SUGGESTIONS });
}
