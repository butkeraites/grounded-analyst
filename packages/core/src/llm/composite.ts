import type { TokenUsage } from "../types.js";
import { hasUsage, type CodeGenContext, type LLMProvider, type UsageAware } from "./provider.js";

/**
 * Tries a primary provider and falls back to a secondary on a "cassette miss".
 * The web demo wires this as [ReplayLLMProvider, McpBridgeLLMProvider]: the
 * seeded questions answer instantly from the cassette; anything new falls
 * through to whatever worker (Claude via MCP) is servicing the bridge.
 */
export class CompositeLLMProvider implements LLMProvider, UsageAware {
  constructor(
    private readonly primary: LLMProvider,
    private readonly fallback: LLMProvider,
  ) {}

  /** Report whichever underlying provider tracked token usage (the fallback, usually). */
  getUsage(): TokenUsage {
    const p = hasUsage(this.primary) ? this.primary.getUsage() : { promptTokens: 0, completionTokens: 0 };
    const f = hasUsage(this.fallback) ? this.fallback.getUsage() : { promptTokens: 0, completionTokens: 0 };
    return { promptTokens: p.promptTokens + f.promptTokens, completionTokens: p.completionTokens + f.completionTokens };
  }

  private isMiss(err: unknown): boolean {
    return err instanceof Error && /cassette miss/i.test(err.message);
  }

  async generateCode(question: string, context: CodeGenContext): Promise<string> {
    try {
      return await this.primary.generateCode(question, context);
    } catch (err) {
      if (this.isMiss(err)) return this.fallback.generateCode(question, context);
      throw err;
    }
  }

  async repairCode(code: string, traceback: string, context: CodeGenContext): Promise<string> {
    try {
      return await this.primary.repairCode(code, traceback, context);
    } catch (err) {
      if (this.isMiss(err)) return this.fallback.repairCode(code, traceback, context);
      throw err;
    }
  }

  async interpret(question: string, stdout: string, onToken?: (chunk: string) => void): Promise<string> {
    try {
      return await this.primary.interpret(question, stdout, onToken);
    } catch (err) {
      if (this.isMiss(err)) return this.fallback.interpret(question, stdout, onToken);
      throw err;
    }
  }
}
