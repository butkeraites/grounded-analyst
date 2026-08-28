import { createCoreServiceFromEnv, type Bootstrapped } from "@grounded/core";

/**
 * The web app's handle onto the core. It owns no analyst logic and no adapter
 * wiring — it calls the shared `createCoreServiceFromEnv`, exactly as the MCP
 * server does. Memoized across dev hot-reloads.
 */

const g = globalThis as unknown as { __groundedBootstrap?: Bootstrapped };

function boot(): Bootstrapped {
  if (!g.__groundedBootstrap) g.__groundedBootstrap = createCoreServiceFromEnv();
  return g.__groundedBootstrap;
}

export function getService() {
  return boot().service;
}

/** Storage bound to this deployment — used to check a dataset's file still exists. */
export function datasetsStorage() {
  return boot().storage;
}
