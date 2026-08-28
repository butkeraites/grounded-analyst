import { NextResponse } from "next/server";
import { getService } from "@/lib/core";
import { repositories } from "@/lib/db";
import { getAnalytics } from "@/lib/analytics";
import { rateLimited } from "@/lib/ratelimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Cap uploads so a huge file can't exhaust memory or run up sandbox cost.
const MAX_UPLOAD_BYTES = 5 * 1024 * 1024; // 5 MB

/** List datasets (most recent first) for the workspace. */
export async function GET() {
  const datasets = await repositories().datasets.list();
  return NextResponse.json({ datasets });
}

/** Upload a CSV → store, profile (in the sandbox), persist, and suggest questions. */
export async function POST(req: Request) {
  const limited = await rateLimited(req);
  if (limited) return limited;

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "expected a file field" }, { status: 400 });
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return NextResponse.json(
      { error: `file too large (max ${MAX_UPLOAD_BYTES / 1024 / 1024} MB)` },
      { status: 413 },
    );
  }

  const service = getService();
  const bytes = new Uint8Array(await file.arrayBuffer());
  const dataset = await service.upload({
    name: file.name,
    contentType: file.type || "text/csv",
    bytes,
  });
  const suggestions = await service.suggestQuestions(dataset.id);

  getAnalytics().capture("dataset_uploaded", {
    datasetId: dataset.id,
    rows: dataset.profile.rowCount,
    columns: dataset.profile.columns.length,
  });

  return NextResponse.json({ dataset, suggestions });
}
