import { fileURLToPath } from "node:url";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";
import { sslFor } from "./client.js";

/**
 * Standalone migration runner. Applies every pending SQL migration in
 * `packages/core/drizzle/` (tracked in drizzle's own migrations table) and
 * exits. Wired as the one-shot `migrate` service in docker-compose, so
 * `docker compose up` brings the schema forward before the web app serves.
 */

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  // Skip gracefully (exit 0) so a build step without a DB configured — e.g. a
  // Vercel preview — doesn't fail. Production has DATABASE_URL and migrates.
  console.error("[migrate] DATABASE_URL not set — skipping migrations");
  process.exit(0);
}

const migrationsFolder = fileURLToPath(new URL("../../drizzle", import.meta.url));

const pool = new Pool({ connectionString, ssl: sslFor(connectionString) });
const db = drizzle(pool);

try {
  console.log(`[migrate] applying migrations from ${migrationsFolder}`);
  await migrate(db, { migrationsFolder });
  console.log("[migrate] up to date");
} catch (err) {
  console.error("[migrate] failed:", err);
  process.exitCode = 1;
} finally {
  await pool.end();
}
