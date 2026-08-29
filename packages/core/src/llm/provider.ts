import type { DatasetProfile, LLMConfig, TokenUsage } from "../types.js";
import { NotImplementedError } from "../errors.js";
import { OpenAICompatibleLLMProvider } from "./openai-compatible.js";

/**
 * Transport-agnostic seam for the LLM step, built around bring-your-own-LLM.
 *
 * Milestone 1 defines the interface and the config/resolution seam only — no
 * concrete adapter is wired. Whether the provider ends up being a cloud API,
 * a local Ollama, or something an MCP caller brings per-request is entirely a
 * config choice (`LLMConfig`), never something the pipeline hard-codes.
 */

/** Context the code-gen prompt is grounded in: the schema, never the model's guess. */
export interface CodeGenContext {
  profile: DatasetProfile;
  /** The dataframe variable the generated code should operate on. */
  dataframeVar: string;
  /** Prior turns' code/interpretation, for follow-ups. */
  history?: Array<{ question: string; code: string }>;
}

export interface LLMProvider {
  /** Turn a natural-language question + dataset schema into runnable Python. */
  generateCode(question: string, context: CodeGenContext): Promise<string>;

  /**
   * Given failing code and its traceback, propose a fix. Drives the
   * error-repair loop so a thrown exception becomes a retry, not a dead end.
   */
  repairCode(code: string, traceback: string, context: CodeGenContext): Promise<string>;

  /**
   * Write a prose interpretation grounded strictly in executed output.
   * Must not introduce any number the code did not produce.
   */
  interpret(question: string, stdout: string): Promise<string>;
}

/** Optionally implemented by providers that can report token usage (for cost). */
export interface UsageAware {
  getUsage(): TokenUsage;
}

export function hasUsage(provider: unknown): provider is UsageAware {
  return typeof (provider as UsageAware | null)?.getUsage === "function";
}

/**
 * Layer a per-request LLM override on top of a deployment default and validate
 * the result. This is the "bring your own LLM, in layers" rule in one place:
 * the environment sets a default, any single caller can override fields of it.
 */
export function resolveLLMConfig(
  base: Partial<LLMConfig>,
  override?: Partial<LLMConfig>,
): LLMConfig {
  const merged: Partial<LLMConfig> = { ...base, ...override };
  if (!merged.kind) throw new Error("LLM config: 'kind' is required (openai-compatible | anthropic)");
  if (!merged.baseUrl) throw new Error("LLM config: 'baseUrl' is required");
  if (!merged.model) throw new Error("LLM config: 'model' is required");
  return merged as LLMConfig;
}

/**
 * Build the concrete provider for a resolved config. The single dispatch point
 * where a BYO config becomes a running client — adapters land in the hard-part
 * milestone; today it throws so the contract is callable but honest.
 */
export function resolveProvider(config: LLMConfig): LLMProvider {
  switch (config.kind) {
    case "openai-compatible":
      return new OpenAICompatibleLLMProvider(config);
    case "anthropic":
      throw new NotImplementedError(`LLM adapter: ${config.kind}`);
    default: {
      const exhaustive: never = config.kind;
      throw new Error(`unknown LLM kind: ${String(exhaustive)}`);
    }
  }
}
