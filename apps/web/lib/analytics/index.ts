import { PostHog } from "posthog-node";
import { logger } from "@grounded/core";

/**
 * Observability seam: the funnel we care about — upload → question → run → chart
 * rendered — plus errors. Every event is structured-logged (always on, $0), and
 * ALSO sent to PostHog when POSTHOG_KEY is configured. No key → logs only, so
 * nothing external is required and the seam is never a no-op that drops data.
 *
 * A real Sentry adapter would drop in here the same way (a second sink on
 * captureError); the seam is the point.
 */

export interface Analytics {
  capture(event: string, properties?: Record<string, unknown>): void;
  captureError(error: unknown, context?: Record<string, unknown>): void;
  identify(distinctId: string, traits?: Record<string, unknown>): void;
}

class ObservabilitySink implements Analytics {
  private readonly posthog: PostHog | null;

  constructor() {
    const key = process.env.POSTHOG_KEY;
    this.posthog = key
      ? new PostHog(key, { host: process.env.POSTHOG_HOST ?? "https://us.i.posthog.com", flushAt: 1, flushInterval: 0 })
      : null;
  }

  capture(event: string, properties: Record<string, unknown> = {}): void {
    logger.info({ event, ...properties }, `event:${event}`);
    this.posthog?.capture({ distinctId: String(properties.datasetId ?? "anon"), event, properties });
  }

  captureError(error: unknown, context: Record<string, unknown> = {}): void {
    const message = error instanceof Error ? error.message : String(error);
    logger.error({ err: error, ...context }, `error: ${message}`);
    this.posthog?.capture({ distinctId: "anon", event: "error", properties: { message, ...context } });
  }

  identify(distinctId: string, traits: Record<string, unknown> = {}): void {
    this.posthog?.identify({ distinctId, properties: traits });
  }
}

const g = globalThis as unknown as { __groundedAnalytics?: Analytics };

export function getAnalytics(): Analytics {
  if (!g.__groundedAnalytics) g.__groundedAnalytics = new ObservabilitySink();
  return g.__groundedAnalytics;
}
