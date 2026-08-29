import pino from "pino";

/**
 * One structured (JSON) logger for every tier. Replaces scattered console.log so
 * production logs are queryable (level, msg, and structured fields) instead of
 * free-text. Level via LOG_LEVEL (default "info"); silent under NODE_ENV=test.
 */
export const logger = pino({
  level: process.env.LOG_LEVEL ?? (process.env.NODE_ENV === "test" ? "silent" : "info"),
  base: { service: "grounded" },
});

export type Logger = typeof logger;
