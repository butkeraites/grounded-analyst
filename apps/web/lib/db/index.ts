import { getDb, makeRepositories, pingDb as corePingDb } from "@julius/core";

/**
 * Web-side handle onto the core's persistence. The web app owns no schema or
 * query logic of its own — it reads DATABASE_URL from its environment and hands
 * it to the core, which is the single source of truth the MCP server also uses.
 */

function url(): string {
  const value = process.env.DATABASE_URL;
  if (!value) throw new Error("DATABASE_URL is not set");
  return value;
}

/** Repositories bound to this deployment's database. */
export function repositories() {
  return makeRepositories(getDb(url()));
}

/** Liveness probe used by the health check. */
export async function pingDb(): Promise<void> {
  await corePingDb(url());
}
