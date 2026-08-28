import { NextResponse } from "next/server";
import { getService, datasetsStorage } from "@/lib/core";
import { repositories } from "@/lib/db";
import { rateLimited } from "@/lib/ratelimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Uploading the seed profiles it in an E2B sandbox — allow time for cold start.
export const maxDuration = 60;

const SEED_NAME = "sales.csv";

// Embedded so the serverless bundle never depends on reading a file from disk
// (Next can't trace a runtime-computed path). Mirrors seed/sales.csv.
const SEED_CSV = `region,month,product,units,revenue
North,Jan,Widget,120,3600
North,Feb,Widget,135,4050
North,Mar,Widget,150,4500
South,Jan,Widget,90,2700
South,Feb,Widget,110,3300
South,Mar,Widget,130,3900
North,Jan,Gadget,60,4200
North,Feb,Gadget,72,5040
North,Mar,Gadget,80,5600
South,Jan,Gadget,45,3150
South,Feb,Gadget,55,3850
South,Mar,Gadget,70,4900
`;

// Curated starter questions for the sample dataset.
const SEED_SUGGESTIONS = [
  "Which region generates the most revenue, and how does it break down by product?",
  "How do monthly revenue trends compare between North and South?",
  "Which product drives more revenue overall, Widget or Gadget?",
];

/**
 * Ensures the seeded sample dataset exists, so the live URL demos in one click.
 * Idempotent: returns the existing seed if already loaded, else uploads it.
 */
export async function GET(req: Request) {
  const limited = await rateLimited(req);
  if (limited) return limited;

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
    bytes: new TextEncoder().encode(SEED_CSV),
  });
  return NextResponse.json({ dataset, suggestions: SEED_SUGGESTIONS });
}
