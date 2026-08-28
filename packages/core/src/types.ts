/**
 * Core domain types shared by every client of the analyst service.
 *
 * These describe the contract of the pipeline — upload -> profile -> code-gen
 * -> execute -> interpret — independent of any transport (HTTP, MCP) or UI.
 * The web app and the future MCP server both speak in these types.
 */

/** A column as understood after profiling an uploaded dataset. */
export interface ColumnProfile {
  name: string;
  /** Coarse type inferred from the data, not the raw storage type. */
  dtype: "integer" | "float" | "boolean" | "datetime" | "categorical" | "string";
  nullCount: number;
  /** Distinct value count; may be approximate for very wide datasets. */
  uniqueCount: number;
  /** A few example values, for prompting and previews. */
  sample: Array<string | number | boolean | null>;
}

/** The result of profiling a dataset: shape + per-column understanding. */
export interface DatasetProfile {
  rowCount: number;
  columns: ColumnProfile[];
}

/** A dataset that has been ingested and profiled. */
export interface Dataset {
  id: string;
  /** Original filename as uploaded. */
  name: string;
  /** Bytes of the stored source file. */
  sizeBytes: number;
  /** Storage key of the raw file — how the sandbox locates it to load as `df`. */
  storageKey: string;
  createdAt: string;
  profile: DatasetProfile;
}

/** Raw bytes + metadata handed to the ingestion path (same for UI and MCP). */
export interface DatasetUpload {
  name: string;
  contentType: string;
  bytes: Uint8Array;
}

/** An artifact produced by executing generated code. */
export type Artifact =
  | { kind: "chart"; mimeType: string; data: string /* base64 or spec JSON */ }
  | { kind: "table"; columns: string[]; rows: Array<Array<string | number | boolean | null>> };

/**
 * Bring-your-own-LLM config. The pipeline never hard-codes a provider; every
 * client supplies one of these — or lets a deployment default fill it in.
 *
 * `openai-compatible` is the lingua franca (OpenAI, Ollama, LM Studio, vLLM,
 * Groq, Together, …), so one adapter covers most providers by pointing baseUrl
 * at their /v1 endpoint. `anthropic` gets a thin adapter of its own.
 */
export type LLMKind = "openai-compatible" | "anthropic";

export interface LLMConfig {
  kind: LLMKind;
  /** e.g. http://ollama:11434/v1 (local) or https://api.openai.com/v1 */
  baseUrl: string;
  /** Optional: keyless local endpoints (e.g. a bare Ollama) don't need one. */
  apiKey?: string;
  /** e.g. qwen2.5-coder, gpt-4o-mini, claude-... */
  model: string;
}

/** A natural-language analysis question against a dataset, with optional context. */
export interface AnalysisRequest {
  datasetId: string;
  question: string;
  /** Prior turns in the thread, for follow-up questions. */
  conversationId?: string;
  /**
   * Per-request BYO-LLM override. Layered over the deployment default, so a
   * single caller (a UI setting, an MCP `ask` argument) can bring its own model
   * without changing how the environment is configured.
   */
  llm?: Partial<LLMConfig>;
}

/** The generated Python for a turn, plus how it ran. */
export interface CodeExecution {
  code: string;
  stdout: string;
  stderr: string;
  /** Number of code-gen -> execute retries the repair loop needed (0 = first try). */
  repairAttempts: number;
  durationMs: number;
}

/** The full result of one analysis turn. */
export interface AnalysisResult {
  /** The run record backing this turn — the handle for get_code/get_chart/get_table. */
  runId: string;
  conversationId: string;
  /** The written interpretation — grounded in the executed output, never invented. */
  interpretation: string;
  artifacts: Artifact[];
  execution: CodeExecution;
}
