import type { CodeGenContext, LLMProvider } from "./provider.js";

/**
 * Tries a primary provider and falls back to a secondary on a "cassette miss".
 * The web demo wires this as [ReplayLLMProvider, McpBridgeLLMProvider]: the
 * seeded questions answer instantly from the cassette; anything new falls
 * through to whatever worker (Claude via MCP) is servicing the bridge.
 */
export class CompositeLLMProvider implements LLMProvider {
  constructor(
    private readonly primary: LLMProvider,
    private readonly fallback: LLMProvider,
  ) {}

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

  async interpret(question: string, stdout: string): Promise<string> {
    try {
      return await this.primary.interpret(question, stdout);
    } catch (err) {
      if (this.isMiss(err)) return this.fallback.interpret(question, stdout);
      throw err;
    }
  }
}
