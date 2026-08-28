import assert from "node:assert/strict";
import { after, test } from "node:test";
import { closeDb, getDb } from "./client.js";
import { makeRepositories } from "./repositories.js";
import type { DatasetProfile } from "../types.js";

/**
 * Integration tests for the persistence contract. Requires a migrated Postgres:
 *
 *   docker compose up -d postgres migrate   # or run db:migrate against it
 *   DATABASE_URL=postgres://grounded:grounded@localhost:5432/grounded \
 *     npm test --workspace @grounded/core
 *
 * Skips cleanly (rather than failing) when no DATABASE_URL is provided, so the
 * suite doesn't break in environments without a database.
 */

const DATABASE_URL = process.env.DATABASE_URL;

const profile: DatasetProfile = {
  rowCount: 3,
  columns: [
    { name: "city", dtype: "categorical", nullCount: 0, uniqueCount: 3, sample: ["SF", "NY", "LA"] },
    { name: "sales", dtype: "float", nullCount: 0, uniqueCount: 3, sample: [1.5, 2.0, 3.25] },
  ],
};

test("persistence: dataset -> conversation -> message -> run round-trip", { skip: !DATABASE_URL }, async () => {
  const repos = makeRepositories(getDb(DATABASE_URL!));

  const dataset = await repos.datasets.create({
    name: "sales.csv",
    contentType: "text/csv",
    sizeBytes: 128,
    storageKey: "local/sales.csv",
    profile,
  });
  assert.ok(dataset.id, "dataset gets an id");
  assert.equal(dataset.profile.rowCount, 3);

  const fetched = await repos.datasets.get(dataset.id);
  assert.equal(fetched?.name, "sales.csv");
  assert.equal(fetched?.profile.columns.length, 2, "jsonb profile survives round-trip");

  const conversation = await repos.conversations.create({ datasetId: dataset.id, title: "first look" });
  assert.equal(conversation.datasetId, dataset.id);

  const userMsg = await repos.messages.add({
    conversationId: conversation.id,
    role: "user",
    content: "which city sells most?",
  });
  assert.equal(userMsg.role, "user");

  // A run opens pending, then completes — the record survives either outcome.
  const run = await repos.runs.create({
    conversationId: conversation.id,
    datasetId: dataset.id,
    question: "which city sells most?",
  });
  assert.equal(run.status, "pending");

  const assistantMsg = await repos.messages.add({
    conversationId: conversation.id,
    role: "assistant",
    content: "SF leads with 3.25.",
  });
  const done = await repos.runs.complete(run.id, {
    status: "success",
    code: "df.groupby('city').sales.sum().idxmax()",
    stdout: "SF\n",
    durationMs: 42,
    repairAttempts: 0,
    messageId: assistantMsg.id,
  });
  assert.equal(done.status, "success");
  assert.equal(done.messageId, assistantMsg.id);

  const thread = await repos.messages.listByConversation(conversation.id);
  assert.equal(thread.length, 2, "both turns are in the thread, in order");
  assert.equal(thread[0]?.role, "user");
  assert.equal(thread[1]?.role, "assistant");
});

after(async () => {
  if (DATABASE_URL) await closeDb();
});
