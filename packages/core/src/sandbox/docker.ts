import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import type { DatasetProfile } from "../types.js";
import type { ExecutionRequest, ExecutionResult, Profiler, SandboxClient } from "./client.js";

/**
 * DockerSandbox — the adapter that makes untrusted execution real.
 *
 * Every run is an EPHEMERAL container (`docker run --rm`) spawned per request
 * and torn down immediately after. Isolation is enforced at the container
 * boundary, not in Python:
 *   --network none        no network, at all
 *   --read-only           immutable root filesystem
 *   --cap-drop ALL        no Linux capabilities
 *   --security-opt no-new-privileges
 *   --user 65534:65534    unprivileged (nobody)
 *   --memory / --cpus / --pids-limit   resource caps
 *   -v <datasets>:/data:ro  dataset mounted read-only
 * plus a hard wall-clock timeout enforced by killing the container.
 *
 * The threat model (docker-socket access from the app tier, and the "optimal"
 * gVisor/Firecracker upgrade) is documented in docs/ARCHITECTURE.md.
 */

export interface DockerSandboxOptions {
  /** Prebuilt sandbox image tag (see sandbox/Dockerfile). */
  image?: string;
  /** Mount source for datasets: a named volume (in compose) or a host path (tests). */
  datasetsMount: string;
  memory?: string; // e.g. "512m"
  cpus?: string; // e.g. "1"
  pidsLimit?: number;
  defaultTimeoutMs?: number;
  /** Path to the docker binary. */
  dockerBin?: string;
}

interface ContainerRun {
  stdout: string;
  stderr: string;
  exitCode: number | null;
  timedOut: boolean;
  durationMs: number;
}

export class DockerSandbox implements SandboxClient, Profiler {
  private readonly image: string;
  private readonly opts: Required<Omit<DockerSandboxOptions, "image">>;

  constructor(options: DockerSandboxOptions) {
    this.image = options.image ?? "julius-sandbox:latest";
    this.opts = {
      datasetsMount: options.datasetsMount,
      memory: options.memory ?? "512m",
      cpus: options.cpus ?? "1",
      pidsLimit: options.pidsLimit ?? 128,
      defaultTimeoutMs: options.defaultTimeoutMs ?? 15_000,
      dockerBin: options.dockerBin ?? "docker",
    };
  }

  async execute(request: ExecutionRequest): Promise<ExecutionResult> {
    const run = await this.runContainer(
      { mode: "execute", code: request.code, dataset_path: `/data/${request.datasetFile}` },
      request.timeoutMs ?? this.opts.defaultTimeoutMs,
    );

    if (run.timedOut) {
      return {
        ok: false,
        stdout: "",
        stderr: `execution timed out after ${request.timeoutMs ?? this.opts.defaultTimeoutMs}ms`,
        timedOut: true,
        durationMs: run.durationMs,
        artifacts: [],
      };
    }

    const envelope = tryParse(run.stdout);
    if (!envelope) {
      // No parseable envelope means the harness itself failed (e.g. the dataset
      // couldn't be loaded) — surface it as a normal, repairable error.
      return {
        ok: false,
        stdout: run.stdout,
        stderr: run.stderr || "sandbox produced no result",
        timedOut: false,
        durationMs: run.durationMs,
        artifacts: [],
      };
    }

    return {
      ok: Boolean(envelope.ok),
      stdout: String(envelope.stdout ?? ""),
      stderr: String(envelope.stderr ?? ""),
      timedOut: false,
      durationMs: run.durationMs,
      artifacts: Array.isArray(envelope.artifacts) ? envelope.artifacts : [],
    };
  }

  async profile(datasetFile: string): Promise<DatasetProfile> {
    const run = await this.runContainer(
      { mode: "profile", dataset_path: `/data/${datasetFile}` },
      this.opts.defaultTimeoutMs,
    );
    const envelope = tryParse(run.stdout);
    if (!envelope || typeof envelope.rowCount !== "number") {
      throw new Error(`profiling failed: ${run.stderr || run.stdout || "no output"}`);
    }
    return envelope as unknown as DatasetProfile;
  }

  private runContainer(job: Record<string, unknown>, timeoutMs: number): Promise<ContainerRun> {
    const name = `julius-sbx-${randomUUID()}`;
    const args = [
      "run",
      "--rm",
      "-i",
      "--name",
      name,
      "--network",
      "none",
      "--read-only",
      "--tmpfs",
      "/tmp",
      "--cap-drop",
      "ALL",
      "--security-opt",
      "no-new-privileges",
      "--user",
      "65534:65534",
      "--memory",
      this.opts.memory,
      "--memory-swap",
      this.opts.memory, // equal to --memory disables swap
      "--cpus",
      this.opts.cpus,
      "--pids-limit",
      String(this.opts.pidsLimit),
      "-v",
      `${this.opts.datasetsMount}:/data:ro`,
      this.image,
    ];

    return new Promise((resolve) => {
      const start = Date.now();
      const child = spawn(this.opts.dockerBin, args, { stdio: ["pipe", "pipe", "pipe"] });
      let stdout = "";
      let stderr = "";
      let timedOut = false;

      const timer = setTimeout(() => {
        timedOut = true;
        // Kill the container out-of-band; --rm still cleans it up.
        spawn(this.opts.dockerBin, ["kill", name], { stdio: "ignore" });
      }, timeoutMs);

      child.stdout.on("data", (d) => (stdout += d.toString()));
      child.stderr.on("data", (d) => (stderr += d.toString()));
      child.on("error", (err) => {
        clearTimeout(timer);
        resolve({ stdout, stderr: stderr + String(err), exitCode: null, timedOut, durationMs: Date.now() - start });
      });
      child.on("close", (code) => {
        clearTimeout(timer);
        resolve({ stdout, stderr, exitCode: code, timedOut, durationMs: Date.now() - start });
      });

      child.stdin.write(JSON.stringify(job));
      child.stdin.end();
    });
  }
}

function tryParse(s: string): Record<string, any> | null {
  const trimmed = s.trim();
  if (!trimmed) return null;
  try {
    return JSON.parse(trimmed);
  } catch {
    return null;
  }
}
