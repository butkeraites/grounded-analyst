import { randomUUID } from "node:crypto";
import type { DatasetProfile } from "../types.js";
import type { CodeGenContext, LLMProvider } from "./provider.js";

/**
 * The "Claude-as-the-LLM" bridge: bring-your-own-LLM taken to its limit, where
 * the model is an MCP host (or any worker) instead of an API.
 *
 * The orchestration loop calls a normal `LLMProvider`; this provider enqueues
 * each code-gen / repair / interpret request onto a bridge and BLOCKS until a
 * worker supplies the answer. The worker side (`pull` + `respond`) is exposed
 * over MCP tools, so an agent literally powers the platform. The core never
 * knows the difference — it's just another `LLMProvider` adapter.
 */

export type LlmRequestKind = "generateCode" | "repairCode" | "interpret";

export interface LlmRequest {
  id: string;
  kind: LlmRequestKind;
  /** generateCode / interpret */
  question?: string;
  /** repairCode */
  code?: string;
  traceback?: string;
  /** interpret — the executed stdout the answer must be grounded in */
  stdout?: string;
  /** code-gen grounding */
  profile?: DatasetProfile;
  dataframeVar?: string;
}

/** Transport between the blocking provider and the worker that answers it. */
export interface LlmBridge {
  /** Enqueue a request and resolve when a worker responds. */
  request(req: Omit<LlmRequest, "id">): Promise<string>;
  /** Worker side: take the next pending request (blocks until one exists or timeout). */
  pull(timeoutMs?: number): Promise<LlmRequest | null>;
  /** Worker side: deliver the answer for a request id. */
  respond(id: string, text: string): Promise<void>;
  close(): Promise<void>;
}

/** LLMProvider whose brain is whatever worker is servicing the bridge. */
export class McpBridgeLLMProvider implements LLMProvider {
  constructor(private readonly bridge: LlmBridge) {}

  generateCode(question: string, context: CodeGenContext): Promise<string> {
    return this.bridge.request({
      kind: "generateCode",
      question,
      profile: context.profile,
      dataframeVar: context.dataframeVar,
    });
  }

  repairCode(code: string, traceback: string, context: CodeGenContext): Promise<string> {
    return this.bridge.request({
      kind: "repairCode",
      code,
      traceback,
      profile: context.profile,
      dataframeVar: context.dataframeVar,
    });
  }

  interpret(question: string, stdout: string): Promise<string> {
    return this.bridge.request({ kind: "interpret", question, stdout });
  }
}

/** In-process bridge for tests and single-process use — no Redis required. */
export class InMemoryLlmBridge implements LlmBridge {
  private queue: LlmRequest[] = [];
  private responders = new Map<string, (text: string) => void>();
  private pullWaiters: Array<(req: LlmRequest) => void> = [];

  request(req: Omit<LlmRequest, "id">): Promise<string> {
    const full: LlmRequest = { ...req, id: randomUUID() };
    return new Promise<string>((resolve) => {
      this.responders.set(full.id, resolve);
      const waiter = this.pullWaiters.shift();
      if (waiter) waiter(full);
      else this.queue.push(full);
    });
  }

  pull(): Promise<LlmRequest | null> {
    const next = this.queue.shift();
    if (next) return Promise.resolve(next);
    return new Promise((resolve) => this.pullWaiters.push(resolve));
  }

  async respond(id: string, text: string): Promise<void> {
    const responder = this.responders.get(id);
    if (responder) {
      responder(text);
      this.responders.delete(id);
    }
  }

  async close(): Promise<void> {
    this.queue = [];
    this.responders.clear();
    this.pullWaiters = [];
  }
}
