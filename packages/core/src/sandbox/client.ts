import type { Artifact, DatasetProfile } from "../types.js";

/**
 * Ports for the isolated execution tier. The orchestration loop depends only on
 * these interfaces — it never knows the sandbox is Docker. That keeps untrusted
 * code execution behind a seam the loop can be tested against with a fake.
 */

/** A request to run untrusted, LLM-generated Python over a dataset. */
export interface ExecutionRequest {
  /** The Python to run. `df` (the dataframe) and pd/np/plt are in scope. */
  code: string;
  /** Storage key of the dataset file to load as `df`, resolved by the adapter. */
  datasetFile: string;
  /** Hard wall-clock cap; the adapter kills the container when it elapses. */
  timeoutMs?: number;
}

/** The outcome of one execution — always returned, never thrown, on user-code error. */
export interface ExecutionResult {
  /** True iff the code ran to completion without an uncaught exception. */
  ok: boolean;
  /** Captured stdout of the user code (never the sandbox's own framing). */
  stdout: string;
  /** Traceback / diagnostics when `ok` is false; empty otherwise. */
  stderr: string;
  /** True if the run was killed for exceeding the timeout. */
  timedOut: boolean;
  durationMs: number;
  /** Chart(s) and result table(s) the code produced. */
  artifacts: Artifact[];
}

/** Executes untrusted code in isolation. The load-bearing security boundary. */
export interface SandboxClient {
  execute(request: ExecutionRequest): Promise<ExecutionResult>;
}

/** Profiles a dataset (a fixed, trusted script) — separated from untrusted execution. */
export interface Profiler {
  profile(datasetFile: string): Promise<DatasetProfile>;
}
