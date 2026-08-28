import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { sql } from "drizzle-orm";
import { Pool } from "pg";
import * as schema from "./schema.js";

/**
 * Postgres access for the core. The connection string is injected by the
 * caller (the web app or the MCP server reads its own env and passes it in),
 * so the core stays env-agnostic and testable against any database.
 *
 * Pools are memoized per connection string to survive dev hot-reloads.
 */

export type Db = NodePgDatabase<typeof schema>;

/** SSL is required by hosted Postgres (Neon), but not by the local container. */
export function sslFor(connectionString: string): { rejectUnauthorized: boolean } | undefined {
  const local = /@(localhost|127\.0\.0\.1|postgres)(:|\/)/.test(connectionString);
  return local ? undefined : { rejectUnauthorized: false };
}

const cache = new Map<string, { pool: Pool; db: Db }>();

export function getDb(connectionString: string): Db {
  let entry = cache.get(connectionString);
  if (!entry) {
    const pool = new Pool({ connectionString, max: 5, ssl: sslFor(connectionString) });
    const db = drizzle(pool, { schema });
    entry = { pool, db };
    cache.set(connectionString, entry);
  }
  return entry.db;
}

/** Liveness probe shared by every client's health check. */
export async function pingDb(connectionString: string): Promise<void> {
  const result = await getDb(connectionString).execute(sql`SELECT 1 AS ok`);
  const ok = (result.rows[0] as { ok: number } | undefined)?.ok;
  if (ok !== 1) {
    throw new Error("unexpected SELECT 1 result");
  }
}

/** Close pooled connections (tests, graceful shutdown). */
export async function closeDb(connectionString?: string): Promise<void> {
  if (connectionString) {
    const entry = cache.get(connectionString);
    if (entry) {
      await entry.pool.end();
      cache.delete(connectionString);
    }
    return;
  }
  await Promise.all([...cache.values()].map((e) => e.pool.end()));
  cache.clear();
}
