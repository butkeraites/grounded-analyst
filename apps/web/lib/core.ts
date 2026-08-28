import { createCoreServiceFromEnv, type Bootstrapped } from "@julius/core";

/**
 * The web app's handle onto the core. It owns no analyst logic and no adapter
 * wiring — it calls the shared `createCoreServiceFromEnv`, exactly as the MCP
 * server does. Memoized across dev hot-reloads.
 */

const g = globalThis as unknown as { __juliusBootstrap?: Bootstrapped };

function boot(): Bootstrapped {
  if (!g.__juliusBootstrap) g.__juliusBootstrap = createCoreServiceFromEnv();
  return g.__juliusBootstrap;
}

export function getService() {
  return boot().service;
}

/** Storage bound to this deployment — used to check a dataset's file still exists. */
export function datasetsStorage() {
  return boot().storage;
}
