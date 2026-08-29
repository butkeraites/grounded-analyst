import { bigint, customType, integer, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import type { Artifact, DatasetProfile } from "../types.js";

/** Raw binary column — for storing dataset bytes when the FS isn't durable (serverless). */
const bytea = customType<{ data: Buffer; driverData: Buffer }>({
  dataType() {
    return "bytea";
  },
});

/**
 * The persistence schema for the core analyst service, owned by `packages/core`
 * so both clients (web UI + MCP server) share one source of truth — no
 * duplicated tables or query logic on the MCP path.
 *
 * Shape mirrors the domain: a dataset is analyzed inside a conversation; each
 * conversation is a thread of messages; every assistant turn is backed by a
 * `run` — the code-gen -> execute record that proves the number came from
 * executed code, never from the model.
 */

export const datasets = pgTable("datasets", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  contentType: text("content_type").notNull(),
  sizeBytes: bigint("size_bytes", { mode: "number" }).notNull(),
  /** Where the raw bytes live (local volume now; object store later). */
  storageKey: text("storage_key").notNull(),
  rowCount: integer("row_count").notNull(),
  /** Full per-column profile, as produced by the profiling step. */
  profile: jsonb("profile").$type<DatasetProfile>().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const conversations = pgTable("conversations", {
  id: uuid("id").primaryKey().defaultRandom(),
  datasetId: uuid("dataset_id")
    .notNull()
    .references(() => datasets.id, { onDelete: "cascade" }),
  title: text("title"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const messages = pgTable("messages", {
  id: uuid("id").primaryKey().defaultRandom(),
  conversationId: uuid("conversation_id")
    .notNull()
    .references(() => conversations.id, { onDelete: "cascade" }),
  role: text("role").$type<"user" | "assistant">().notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const runs = pgTable("runs", {
  id: uuid("id").primaryKey().defaultRandom(),
  conversationId: uuid("conversation_id")
    .notNull()
    .references(() => conversations.id, { onDelete: "cascade" }),
  datasetId: uuid("dataset_id")
    .notNull()
    .references(() => datasets.id, { onDelete: "cascade" }),
  /** The assistant message this run produced, once persisted. */
  messageId: uuid("message_id").references(() => messages.id, { onDelete: "set null" }),
  question: text("question").notNull(),
  status: text("status").$type<"pending" | "success" | "error">().notNull().default("pending"),
  code: text("code"),
  stdout: text("stdout"),
  stderr: text("stderr"),
  /** How many code-gen -> execute retries the repair loop needed (0 = first try). */
  repairAttempts: integer("repair_attempts").notNull().default(0),
  durationMs: integer("duration_ms"),
  /** LLM token usage for the turn — the basis for cost accounting. */
  promptTokens: integer("prompt_tokens"),
  completionTokens: integer("completion_tokens"),
  artifacts: jsonb("artifacts").$type<Artifact[]>(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

/** Durable dataset bytes, keyed by storageKey — the serverless-safe Storage backend. */
export const datasetFiles = pgTable("dataset_files", {
  key: text("key").primaryKey(),
  bytes: bytea("bytes").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export type DatasetRow = typeof datasets.$inferSelect;
export type ConversationRow = typeof conversations.$inferSelect;
export type MessageRow = typeof messages.$inferSelect;
export type RunRow = typeof runs.$inferSelect;
