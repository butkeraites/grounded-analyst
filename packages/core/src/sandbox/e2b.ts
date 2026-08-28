import { Sandbox, TimeoutError } from "@e2b/code-interpreter";
import type { DatasetProfile } from "../types.js";
import type { ExecutionRequest, ExecutionResult, Profiler, SandboxClient } from "./client.js";
import type { Storage } from "../storage/client.js";

/**
 * E2BSandbox — the production execution adapter. Untrusted LLM Python runs in an
 * E2B cloud sandbox (isolated microVM) instead of a local Docker container, so
 * the app can execute code from a serverless host (Vercel) that has no Docker.
 * Same `SandboxClient`/`Profiler` ports as `DockerSandbox`; the ADR calls E2B
 * the optimal hosted sandbox.
 *
 * It runs the SAME harness contract as the Docker runner (one JSON envelope),
 * so charts/tables come back byte-for-byte identical across dev and prod.
 */

const DATA_PATH = "/home/user/data.csv";

export interface E2BSandboxOptions {
  apiKey?: string;
  /** Reads dataset bytes by storage key to upload into the sandbox. */
  storage: Storage;
  defaultTimeoutMs?: number;
}

export class E2BSandbox implements SandboxClient, Profiler {
  private readonly apiKey?: string;
  private readonly storage: Storage;
  private readonly defaultTimeoutMs: number;

  constructor(options: E2BSandboxOptions) {
    this.apiKey = options.apiKey;
    this.storage = options.storage;
    this.defaultTimeoutMs = options.defaultTimeoutMs ?? 30_000;
  }

  async execute(request: ExecutionRequest): Promise<ExecutionResult> {
    const timeoutMs = request.timeoutMs ?? this.defaultTimeoutMs;
    const start = Date.now();
    try {
      const envelope = await this.run(
        { mode: "execute", code: request.code, dataset_path: DATA_PATH },
        request.datasetFile,
        timeoutMs,
      );
      return {
        ok: Boolean(envelope.ok),
        stdout: String(envelope.stdout ?? ""),
        stderr: String(envelope.stderr ?? ""),
        timedOut: false,
        durationMs: Date.now() - start,
        artifacts: Array.isArray(envelope.artifacts) ? envelope.artifacts : [],
      };
    } catch (err) {
      const timedOut = err instanceof TimeoutError;
      return {
        ok: false,
        stdout: "",
        stderr: timedOut ? `execution timed out after ${timeoutMs}ms` : String((err as Error).message ?? err),
        timedOut,
        durationMs: Date.now() - start,
        artifacts: [],
      };
    }
  }

  async profile(datasetFile: string): Promise<DatasetProfile> {
    const envelope = await this.run({ mode: "profile", dataset_path: DATA_PATH }, datasetFile, this.defaultTimeoutMs);
    if (typeof envelope.rowCount !== "number") {
      throw new Error(`profiling failed: ${JSON.stringify(envelope).slice(0, 200)}`);
    }
    return envelope as unknown as DatasetProfile;
  }

  /** Spin up an ephemeral sandbox, upload the dataset, run the harness, tear down. */
  private async run(job: Record<string, unknown>, datasetFile: string, timeoutMs: number): Promise<Record<string, any>> {
    const bytes = await this.storage.read(datasetFile);
    const sandbox = await Sandbox.create({ apiKey: this.apiKey, timeoutMs: timeoutMs + 15_000 });
    try {
      await sandbox.files.write(DATA_PATH, new TextDecoder().decode(bytes));
      const program = harness(job);
      const execution = await sandbox.runCode(program, { timeoutMs });

      const stdout = execution.logs.stdout.join("");
      const parsed = tryParse(stdout);
      if (parsed) return parsed;
      // The harness itself failed (e.g. the CSV couldn't be read) — surface it.
      return {
        ok: false,
        stdout,
        stderr: execution.error?.traceback ?? execution.logs.stderr.join("") ?? "sandbox produced no result",
        artifacts: [],
      };
    } finally {
      await sandbox.kill().catch(() => {});
    }
  }
}

/** The Python harness: mirrors sandbox/runner.py, with the job injected as base64. */
function harness(job: Record<string, unknown>): string {
  const b64 = Buffer.from(JSON.stringify(job)).toString("base64");
  return `
import base64, json, io, traceback
from contextlib import redirect_stdout
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd

_JOB = json.loads(base64.b64decode("${b64}").decode())
MAX_TABLE_ROWS = 200

def _dtype(s):
    if pd.api.types.is_bool_dtype(s): return "boolean"
    if pd.api.types.is_integer_dtype(s): return "integer"
    if pd.api.types.is_float_dtype(s): return "float"
    if pd.api.types.is_datetime64_any_dtype(s): return "datetime"
    n = s.nunique(dropna=True)
    if n <= 20 and n < len(s): return "categorical"
    return "string"

def _safe(v):
    if v is None: return None
    if isinstance(v, (np.integer,)): return int(v)
    if isinstance(v, (np.floating,)): return None if np.isnan(v) else float(v)
    if isinstance(v, (np.bool_,)): return bool(v)
    try:
        if pd.isna(v): return None
    except (ValueError, TypeError):
        pass
    if isinstance(v, (int, float, bool, str)): return v
    return str(v)

def profile(df):
    cols = []
    for name in df.columns:
        s = df[name]; nn = s.dropna()
        cols.append({"name": str(name), "dtype": _dtype(s), "nullCount": int(s.isna().sum()),
                     "uniqueCount": int(s.nunique(dropna=True)), "sample": [_safe(x) for x in nn.unique()[:5]]})
    return {"rowCount": int(len(df)), "columns": cols}

def _artifacts(scope):
    arts = []
    for num in plt.get_fignums():
        fig = plt.figure(num); buf = io.BytesIO()
        fig.savefig(buf, format='png', bbox_inches='tight', dpi=120)
        arts.append({"kind": "chart", "mimeType": "image/png", "data": base64.b64encode(buf.getvalue()).decode('ascii')})
    r = scope.get('result')
    if isinstance(r, pd.Series): r = r.reset_index()
    if isinstance(r, pd.DataFrame):
        head = r.head(MAX_TABLE_ROWS)
        arts.append({"kind": "table", "columns": [str(c) for c in head.columns],
                     "rows": [[_safe(v) for v in row] for row in head.itertuples(index=False, name=None)]})
    return arts

def execute(code, df):
    scope = {"df": df, "pd": pd, "np": np, "plt": plt}; cap = io.StringIO()
    try:
        with redirect_stdout(cap):
            exec(code, scope)
        return {"ok": True, "stdout": cap.getvalue(), "stderr": "", "artifacts": _artifacts(scope)}
    except Exception:
        return {"ok": False, "stdout": cap.getvalue(), "stderr": traceback.format_exc(), "artifacts": []}
    finally:
        plt.close('all')

df = pd.read_csv(_JOB["dataset_path"])
env = profile(df) if _JOB.get("mode") == "profile" else execute(_JOB.get("code", ""), df)
print(json.dumps(env))
`;
}

function tryParse(s: string): Record<string, any> | null {
  const t = s.trim();
  if (!t) return null;
  try {
    return JSON.parse(t);
  } catch {
    // The harness prints exactly one JSON line; if extra output exists, take the last line.
    const last = t.split("\n").filter(Boolean).pop();
    try {
      return last ? JSON.parse(last) : null;
    } catch {
      return null;
    }
  }
}
