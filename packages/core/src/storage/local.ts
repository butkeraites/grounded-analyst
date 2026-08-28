import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { Storage } from "./client.js";

/**
 * Filesystem-backed storage. In Docker this baseDir is a named volume that the
 * sandbox also mounts read-only, so a dataset written here is exactly what the
 * ephemeral execution container reads as `df`.
 */
export class LocalStorage implements Storage {
  constructor(private readonly baseDir: string) {}

  private full(key: string): string {
    // Keys are generated (uuid + ext); reject anything with path separators.
    if (key.includes("/") || key.includes("..")) throw new Error(`invalid storage key: ${key}`);
    return join(this.baseDir, key);
  }

  async put(key: string, bytes: Uint8Array): Promise<string> {
    await mkdir(this.baseDir, { recursive: true });
    await writeFile(this.full(key), bytes);
    return key;
  }

  async read(key: string): Promise<Uint8Array> {
    return new Uint8Array(await readFile(this.full(key)));
  }

  async exists(key: string): Promise<boolean> {
    try {
      await access(this.full(key));
      return true;
    } catch {
      return false;
    }
  }
}
