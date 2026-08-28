import { eq } from "drizzle-orm";
import type { Db } from "../db/client.js";
import { datasetFiles } from "../db/schema.js";
import type { Storage } from "./client.js";

/**
 * Postgres-backed storage: dataset bytes live in a `bytea` column instead of on
 * disk. This is what makes the app deployable to a serverless host (Vercel),
 * where the filesystem is ephemeral — the same Storage port, a different backend.
 */
export class PostgresStorage implements Storage {
  constructor(private readonly db: Db) {}

  async put(key: string, bytes: Uint8Array): Promise<string> {
    const buf = Buffer.from(bytes);
    await this.db
      .insert(datasetFiles)
      .values({ key, bytes: buf })
      .onConflictDoUpdate({ target: datasetFiles.key, set: { bytes: buf } });
    return key;
  }

  async read(key: string): Promise<Uint8Array> {
    const [row] = await this.db
      .select({ bytes: datasetFiles.bytes })
      .from(datasetFiles)
      .where(eq(datasetFiles.key, key))
      .limit(1);
    if (!row) throw new Error(`dataset file not found: ${key}`);
    return new Uint8Array(row.bytes);
  }

  async exists(key: string): Promise<boolean> {
    const [row] = await this.db
      .select({ key: datasetFiles.key })
      .from(datasetFiles)
      .where(eq(datasetFiles.key, key))
      .limit(1);
    return Boolean(row);
  }
}
