import { join, resolve } from "node:path";

/**
 * Resolve the repo's `seed/` directory. Next route handlers run with cwd at the
 * web workspace (`apps/web`), so we walk up to the repo root unless SEED_DIR
 * says otherwise (set explicitly in docker-compose).
 */
export function seedDir(): string {
  return process.env.SEED_DIR ?? resolve(process.cwd(), "..", "..", "seed");
}

export function seedFile(name: string): string {
  return join(seedDir(), name);
}
