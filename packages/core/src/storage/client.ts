/**
 * Storage port for raw dataset bytes. The web app and MCP server share one
 * implementation; the sandbox mounts the same backing store read-only.
 */
export interface Storage {
  /** Persist bytes under a key, returning the key actually used. */
  put(key: string, bytes: Uint8Array): Promise<string>;
  read(key: string): Promise<Uint8Array>;
  exists(key: string): Promise<boolean>;
}
