import assert from "node:assert/strict";
import { after, test } from "node:test";
import { closeDb, getDb } from "../db/client.js";
import { PostgresStorage } from "./postgres.js";

/**
 * PostgresStorage round-trip against a migrated Postgres. Proves dataset bytes
 * survive in the DB (the serverless-safe backend). Skips without DATABASE_URL.
 */
const DATABASE_URL = process.env.DATABASE_URL;

test("postgres storage: put -> exists -> read round-trip", { skip: !DATABASE_URL }, async () => {
  const storage = new PostgresStorage(getDb(DATABASE_URL!));
  const key = `test-${Date.now()}.csv`;
  const original = new TextEncoder().encode("a,b\n1,2\n3,4\n");

  assert.equal(await storage.exists(key), false);
  await storage.put(key, original);
  assert.equal(await storage.exists(key), true);

  const readBack = await storage.read(key);
  assert.deepEqual([...readBack], [...original], "bytes survive the round-trip");

  // put is idempotent (upsert)
  await storage.put(key, new TextEncoder().encode("x"));
  assert.deepEqual([...(await storage.read(key))], [...new TextEncoder().encode("x")]);
});

after(async () => {
  if (DATABASE_URL) await closeDb();
});
