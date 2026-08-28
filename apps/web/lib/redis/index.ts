import Redis from "ioredis";

/**
 * Redis behind the standard protocol (ioredis) against a local `redis:7`
 * container. Julius-style Upstash speaks a REST client instead; keeping access
 * behind this module means the hosted swap is one file, not a scattered change.
 *
 * The connection is memoized across dev hot-reloads via globalThis.
 */

const globalForRedis = globalThis as unknown as { __juliusRedis?: Redis };

export function getRedis(): Redis {
  if (!globalForRedis.__juliusRedis) {
    const url = process.env.REDIS_URL;
    if (!url) {
      throw new Error("REDIS_URL is not set");
    }
    globalForRedis.__juliusRedis = new Redis(url, { lazyConnect: false, maxRetriesPerRequest: 2 });
  }
  return globalForRedis.__juliusRedis;
}

/** Liveness probe used by the health check. */
export async function pingRedis(): Promise<void> {
  const pong = await getRedis().ping();
  if (pong !== "PONG") {
    throw new Error(`unexpected PING result: ${pong}`);
  }
}
