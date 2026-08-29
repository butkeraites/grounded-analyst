import { desc, eq, sql } from "drizzle-orm";
import type { Db } from "./client.js";
import { conversations, datasets, messages, runs } from "./schema.js";
import type { ConversationRow, MessageRow, RunRow } from "./schema.js";
import type { Artifact, Dataset, DatasetProfile } from "../types.js";

/**
 * Repositories are the persistence contract of the core. Both clients get them
 * by calling `makeRepositories(db)` with an injected connection — there is no
 * second implementation on the MCP path.
 *
 * `datasets` maps to the domain `Dataset`; conversations/messages/runs return
 * their typed rows directly (no parallel domain type needed yet).
 */

export interface NewDataset {
  name: string;
  contentType: string;
  sizeBytes: number;
  /** Where the raw bytes were stored during ingestion. */
  storageKey: string;
  profile: DatasetProfile;
}

/** Patch applied when a run finishes (or fails), closing out the pending record. */
export interface RunCompletion {
  status: "success" | "error";
  code?: string;
  stdout?: string;
  stderr?: string;
  repairAttempts?: number;
  durationMs?: number;
  promptTokens?: number;
  completionTokens?: number;
  artifacts?: Artifact[];
  messageId?: string;
}

/** Persistence ports the core depends on — implemented here by Drizzle, fakeable in tests. */
export interface DatasetRepo {
  create(input: NewDataset): Promise<Dataset>;
  get(id: string): Promise<Dataset | null>;
  list(): Promise<Dataset[]>;
}
export interface ConversationRepo {
  create(input: { datasetId: string; title?: string }): Promise<ConversationRow>;
  get(id: string): Promise<ConversationRow | null>;
  listByDataset(datasetId: string): Promise<ConversationRow[]>;
  list(): Promise<ConversationRow[]>;
}
export interface MessageRepo {
  add(input: { conversationId: string; role: "user" | "assistant"; content: string }): Promise<MessageRow>;
  listByConversation(conversationId: string): Promise<MessageRow[]>;
}
/** Aggregate operational/cost metrics over all runs. */
export interface UsageStats {
  analyses: number;
  successes: number;
  avgDurationMs: number;
  promptTokens: number;
  completionTokens: number;
}

export interface RunRepo {
  create(input: { conversationId: string; datasetId: string; question: string }): Promise<RunRow>;
  complete(id: string, patch: RunCompletion): Promise<RunRow>;
  get(id: string): Promise<RunRow | null>;
  usageStats(): Promise<UsageStats>;
}
export interface Repositories {
  datasets: DatasetRepo;
  conversations: ConversationRepo;
  messages: MessageRepo;
  runs: RunRepo;
}

function toDataset(r: typeof datasets.$inferSelect): Dataset {
  return {
    id: r.id,
    name: r.name,
    sizeBytes: r.sizeBytes,
    storageKey: r.storageKey,
    createdAt: r.createdAt.toISOString(),
    profile: r.profile,
  };
}

export function makeRepositories(db: Db): Repositories {
  return {
    datasets: {
      async create(input: NewDataset): Promise<Dataset> {
        const [row] = await db
          .insert(datasets)
          .values({
            name: input.name,
            contentType: input.contentType,
            sizeBytes: input.sizeBytes,
            storageKey: input.storageKey,
            rowCount: input.profile.rowCount,
            profile: input.profile,
          })
          .returning();
        return toDataset(row!);
      },
      async get(id: string): Promise<Dataset | null> {
        const [row] = await db.select().from(datasets).where(eq(datasets.id, id)).limit(1);
        return row ? toDataset(row) : null;
      },
      async list(): Promise<Dataset[]> {
        const rows = await db.select().from(datasets).orderBy(desc(datasets.createdAt));
        return rows.map(toDataset);
      },
    },

    conversations: {
      async create(input: { datasetId: string; title?: string }): Promise<ConversationRow> {
        const [row] = await db
          .insert(conversations)
          .values({ datasetId: input.datasetId, title: input.title ?? null })
          .returning();
        return row!;
      },
      async get(id: string): Promise<ConversationRow | null> {
        const [row] = await db
          .select()
          .from(conversations)
          .where(eq(conversations.id, id))
          .limit(1);
        return row ?? null;
      },
      async listByDataset(datasetId: string): Promise<ConversationRow[]> {
        return db
          .select()
          .from(conversations)
          .where(eq(conversations.datasetId, datasetId))
          .orderBy(desc(conversations.createdAt));
      },
      async list(): Promise<ConversationRow[]> {
        return db.select().from(conversations).orderBy(desc(conversations.createdAt));
      },
    },

    messages: {
      async add(input: {
        conversationId: string;
        role: "user" | "assistant";
        content: string;
      }): Promise<MessageRow> {
        const [row] = await db
          .insert(messages)
          .values({
            conversationId: input.conversationId,
            role: input.role,
            content: input.content,
          })
          .returning();
        return row!;
      },
      async listByConversation(conversationId: string): Promise<MessageRow[]> {
        return db
          .select()
          .from(messages)
          .where(eq(messages.conversationId, conversationId))
          .orderBy(messages.createdAt);
      },
    },

    runs: {
      /** Open a run in `pending` before code-gen, so failures leave a record. */
      async create(input: {
        conversationId: string;
        datasetId: string;
        question: string;
      }): Promise<RunRow> {
        const [row] = await db
          .insert(runs)
          .values({
            conversationId: input.conversationId,
            datasetId: input.datasetId,
            question: input.question,
          })
          .returning();
        return row!;
      },
      async complete(id: string, patch: RunCompletion): Promise<RunRow> {
        const [row] = await db
          .update(runs)
          .set({
            status: patch.status,
            code: patch.code,
            stdout: patch.stdout,
            stderr: patch.stderr,
            repairAttempts: patch.repairAttempts ?? 0,
            durationMs: patch.durationMs,
            promptTokens: patch.promptTokens,
            completionTokens: patch.completionTokens,
            artifacts: patch.artifacts,
            messageId: patch.messageId,
          })
          .where(eq(runs.id, id))
          .returning();
        return row!;
      },
      async get(id: string): Promise<RunRow | null> {
        const [row] = await db.select().from(runs).where(eq(runs.id, id)).limit(1);
        return row ?? null;
      },
      async usageStats(): Promise<UsageStats> {
        const [r] = await db
          .select({
            analyses: sql<number>`count(*)::int`,
            successes: sql<number>`count(*) filter (where ${runs.status} = 'success')::int`,
            avgDurationMs: sql<number>`coalesce(round(avg(${runs.durationMs})), 0)::int`,
            promptTokens: sql<number>`coalesce(sum(${runs.promptTokens}), 0)::int`,
            completionTokens: sql<number>`coalesce(sum(${runs.completionTokens}), 0)::int`,
          })
          .from(runs);
        return r ?? { analyses: 0, successes: 0, avgDurationMs: 0, promptTokens: 0, completionTokens: 0 };
      },
    },
  };
}
