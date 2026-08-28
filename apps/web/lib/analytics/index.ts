/**
 * Analytics seam. The funnel we care about — upload -> question -> run ->
 * chart rendered — will be instrumented through this interface.
 *
 * Milestone 1 runs 100% local, so the concrete adapter is a no-op that logs to
 * the console. A real PostHog adapter is a drop-in replacement gated on
 * POSTHOG_KEY; the call sites never change.
 */

export interface Analytics {
  capture(event: string, properties?: Record<string, unknown>): void;
  identify(distinctId: string, traits?: Record<string, unknown>): void;
}

class NoopAnalytics implements Analytics {
  capture(event: string, properties?: Record<string, unknown>): void {
    console.log(`[analytics:noop] capture ${event}`, properties ?? {});
  }

  identify(distinctId: string, traits?: Record<string, unknown>): void {
    console.log(`[analytics:noop] identify ${distinctId}`, traits ?? {});
  }
}

let instance: Analytics | undefined;

export function getAnalytics(): Analytics {
  // When a real provider is added, branch on process.env.POSTHOG_KEY here.
  if (!instance) {
    instance = new NoopAnalytics();
  }
  return instance;
}
