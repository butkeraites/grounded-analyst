import type {
  AnalysisRequest,
  AnalysisResult,
  Artifact,
  Dataset,
  DatasetUpload,
  LLMConfig,
} from "./types.js";
import { extname } from "node:path";
import { randomUUID } from "node:crypto";
import { hasUsage, type LLMProvider } from "./llm/provider.js";
import type { SandboxClient, Profiler } from "./sandbox/client.js";
import type { Storage } from "./storage/client.js";
import type { Repositories } from "./db/repositories.js";

/**
 * The callable core: `createCoreService(deps)` wires the injected ports —
 * persistence, sandbox, profiler, storage, and a per-request LLM resolver —
 * into the analyst use-cases. Both clients (web UI, MCP server) construct this
 * with their own adapters; the use-cases below are the *only* implementation.
 */

/** Resolves a concrete LLM provider from an optional per-request override. */
export type LLMResolver = (override?: Partial<LLMConfig>) => LLMProvider;

export interface CoreDeps {
  repos: Repositories;
  sandbox: SandboxClient;
  profiler: Profiler;
  storage: Storage;
  /** Layers a per-request BYO-LLM override over the deployment default. */
  llm: LLMResolver;
  /** How many code-gen -> execute repairs to attempt before giving up (default 2). */
  maxRepairAttempts?: number;
}

/** Coarse progress of an analyze turn, for streaming a UI. */
export type AnalyzePhase =
  | { phase: "generating" }
  | { phase: "executing" }
  | { phase: "repairing"; attempt: number }
  | { phase: "interpreting" };

export interface AnalyzeHooks {
  onPhase?: (event: AnalyzePhase) => void;
  /** Called with each interpretation token as it streams (when the model supports it). */
  onToken?: (chunk: string) => void;
}

export interface CoreService {
  upload(input: DatasetUpload): Promise<Dataset>;
  /** Deterministic starter questions derived from the dataset's profile (no LLM). */
  suggestQuestions(datasetId: string): Promise<string[]>;
  analyze(request: AnalysisRequest, hooks?: AnalyzeHooks): Promise<AnalysisResult>;
}

/** Render executed artifacts as text so `interpret` can be grounded even when
 * the code produced a chart/table but printed nothing to stdout. */
function describeArtifacts(artifacts: Artifact[]): string {
  const parts: string[] = [];
  for (const a of artifacts) {
    if (a.kind === "table") {
      const rows = a.rows.slice(0, 15).map((r) => r.map(String).join(" | ")).join("\n");
      parts.push(`Result table [${a.columns.join(" | ")}]:\n${rows}`);
    } else if (a.kind === "chart") {
      parts.push("(a chart was produced)");
    }
  }
  return parts.join("\n\n");
}

export function createCoreService(deps: CoreDeps): CoreService {
  const maxRepairAttempts = deps.maxRepairAttempts ?? 2;
  const DATAFRAME_VAR = "df";

  return {
    // Ingest + profile: store the raw bytes, then profile them IN the sandbox
    // (same isolation as untrusted execution), and persist the described dataset.
    async upload(input: DatasetUpload): Promise<Dataset> {
      const { storage, profiler, repos } = deps;
      const key = `${randomUUID()}${extname(input.name) || ".csv"}`;
      await storage.put(key, input.bytes);
      const profile = await profiler.profile(key);
      return repos.datasets.create({
        name: input.name,
        contentType: input.contentType,
        sizeBytes: input.bytes.byteLength,
        storageKey: key,
        profile,
      });
    },

    async suggestQuestions(datasetId: string): Promise<string[]> {
      const dataset = await deps.repos.datasets.get(datasetId);
      if (!dataset) throw new Error(`dataset not found: ${datasetId}`);
      const cats = dataset.profile.columns.filter((c) => c.dtype === "categorical");
      const nums = dataset.profile.columns.filter((c) => c.dtype === "integer" || c.dtype === "float");
      const cat = cats[0]?.name;
      const num = nums[0]?.name;
      const out: string[] = [];
      if (num && cat) out.push(`How does total ${num} break down by ${cat}?`);
      if (num) out.push(`What is the overall distribution of ${num}?`);
      if (cat && num) out.push(`Which ${cat} has the highest average ${num}?`);
      if (cats[1]?.name && num) out.push(`How does ${num} compare across ${cat} and ${cats[1].name}?`);
      if (out.length === 0) out.push("What does this dataset contain, and what stands out?");
      return out.slice(0, 4);
    },

    async analyze(request: AnalysisRequest, hooks?: AnalyzeHooks): Promise<AnalysisResult> {
      const { repos, sandbox } = deps;
      const emit = (event: AnalyzePhase) => hooks?.onPhase?.(event);

      const dataset = await repos.datasets.get(request.datasetId);
      if (!dataset) {
        throw new Error(`dataset not found: ${request.datasetId}`);
      }
      // Fail fast (and clearly) if the stored file is gone — otherwise a missing
      // file surfaces as a sandbox error that the repair loop pointlessly tries
      // to "fix" via the LLM, hanging the turn. Infra problems aren't the model's
      // to repair.
      if (!(await deps.storage.exists(dataset.storageKey))) {
        throw new Error(`dataset file is unavailable (${dataset.name}); please re-upload it`);
      }

      // Thread continuity: reuse the conversation for follow-ups, else open one.
      const conversation = request.conversationId
        ? await repos.conversations.get(request.conversationId)
        : await repos.conversations.create({ datasetId: dataset.id });
      if (!conversation) {
        throw new Error(`conversation not found: ${request.conversationId}`);
      }

      await repos.messages.add({ conversationId: conversation.id, role: "user", content: request.question });
      // Open the run up front so a failure still leaves an audit record.
      const run = await repos.runs.create({
        conversationId: conversation.id,
        datasetId: dataset.id,
        question: request.question,
      });

      const llm = deps.llm(request.llm);
      const context = { profile: dataset.profile, dataframeVar: DATAFRAME_VAR };

      // Code-gen -> execute -> (repair -> execute)* : we run the model's code in
      // the sandbox and, on an uncaught exception, feed the traceback back for a
      // fix. We never interpret — never produce a number — for a failed run.
      emit({ phase: "generating" });
      let code = await llm.generateCode(request.question, context);
      emit({ phase: "executing" });
      let execution = await sandbox.execute({ code, datasetFile: dataset.storageKey });
      let repairAttempts = 0;

      while (!execution.ok && repairAttempts < maxRepairAttempts) {
        repairAttempts += 1;
        emit({ phase: "repairing", attempt: repairAttempts });
        code = await llm.repairCode(code, execution.stderr, context);
        emit({ phase: "executing" });
        execution = await sandbox.execute({ code, datasetFile: dataset.storageKey });
      }

      const usage = () => (hasUsage(llm) ? llm.getUsage() : undefined);

      if (!execution.ok) {
        await repos.runs.complete(run.id, {
          status: "error",
          code,
          stderr: execution.stderr,
          repairAttempts,
          durationMs: execution.durationMs,
          promptTokens: usage()?.promptTokens,
          completionTokens: usage()?.completionTokens,
        });
        throw new Error(`execution failed after ${repairAttempts} repair attempt(s): ${execution.stderr}`);
      }

      // Grounding: interpret only from EXECUTED evidence — stdout, or the result
      // table when the code plotted without printing. With no evidence at all we
      // return a fixed factual line rather than let a weak model invent one.
      emit({ phase: "interpreting" });
      const evidence = execution.stdout.trim() ? execution.stdout : describeArtifacts(execution.artifacts);
      const interpretation = evidence.trim()
        ? await llm.interpret(request.question, evidence, hooks?.onToken)
        : "Done — the requested output was generated.";
      const assistant = await repos.messages.add({
        conversationId: conversation.id,
        role: "assistant",
        content: interpretation,
      });
      await repos.runs.complete(run.id, {
        status: "success",
        code,
        stdout: execution.stdout,
        artifacts: execution.artifacts,
        repairAttempts,
        durationMs: execution.durationMs,
        promptTokens: usage()?.promptTokens,
        completionTokens: usage()?.completionTokens,
        messageId: assistant.id,
      });

      return {
        runId: run.id,
        conversationId: conversation.id,
        interpretation,
        artifacts: execution.artifacts,
        execution: {
          code,
          stdout: execution.stdout,
          stderr: execution.stderr,
          repairAttempts,
          durationMs: execution.durationMs,
        },
      };
    },
  };
}
