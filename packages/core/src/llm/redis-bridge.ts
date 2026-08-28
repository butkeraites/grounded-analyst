import Redis from "ioredis";
import { randomUUID } from "node:crypto";
import type { LlmBridge, LlmRequest } from "./bridge.js";

/**
 * Redis-backed bridge. The web process (or CLI) that runs `analyze` enqueues
 * requests; a separate worker process (the MCP server an agent drives) pulls
 * and responds. Uses BLPOP for true blocking hand-off — no polling.
 *
 * Requests live on one list; each response goes to a per-id list the requester
 * blocks on. A dedicated connection is used per blocking wait, since BLPOP ties
 * up a connection.
 */

const REQUESTS_KEY = "llm:requests";
const RESPONSE_KEY = (id: string) => `llm:resp:${id}`;
const RESPONSE_TTL_SECONDS = 300;

export class RedisLlmBridge implements LlmBridge {
  private readonly url: string;
  private readonly requestTimeoutMs: number;
  private readonly conns: Redis[] = [];

  constructor(url: string, options: { requestTimeoutMs?: number } = {}) {
    this.url = url;
    this.requestTimeoutMs = options.requestTimeoutMs ?? 300_000;
  }

  private conn(): Redis {
    const c = new Redis(this.url, { maxRetriesPerRequest: null });
    this.conns.push(c);
    return c;
  }

  async request(req: Omit<LlmRequest, "id">): Promise<string> {
    const full: LlmRequest = { ...req, id: randomUUID() };
    const pub = this.conn();
    const waiter = this.conn();
    try {
      await pub.rpush(REQUESTS_KEY, JSON.stringify(full));
      const seconds = Math.ceil(this.requestTimeoutMs / 1000);
      const result = await waiter.blpop(RESPONSE_KEY(full.id), seconds);
      if (!result) {
        throw new Error(
          "No model is connected to answer this question. Try one of the suggested questions, " +
            "or connect a model (an MCP host on the bridge, or a local LLM).",
        );
      }
      return result[1];
    } finally {
      pub.disconnect();
      waiter.disconnect();
    }
  }

  async pull(timeoutMs = 0): Promise<LlmRequest | null> {
    const c = this.conn();
    try {
      const seconds = Math.ceil(timeoutMs / 1000);
      const result = await c.blpop(REQUESTS_KEY, seconds);
      return result ? (JSON.parse(result[1]) as LlmRequest) : null;
    } finally {
      c.disconnect();
    }
  }

  async respond(id: string, text: string): Promise<void> {
    const c = this.conn();
    try {
      await c.rpush(RESPONSE_KEY(id), text);
      await c.expire(RESPONSE_KEY(id), RESPONSE_TTL_SECONDS);
    } finally {
      c.disconnect();
    }
  }

  async close(): Promise<void> {
    for (const c of this.conns) c.disconnect();
    this.conns.length = 0;
  }
}
