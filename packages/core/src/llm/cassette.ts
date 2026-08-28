import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import type { CodeGenContext, LLMProvider } from "./provider.js";

/**
 * Record/replay ("cassette") for the LLM step. During a recording run the model
 * (e.g. Claude via the bridge) answers for real and every answer is captured,
 * keyed by the salient inputs. The seeded public demo then REPLAYS the cassette
 * — deterministic, 100% local, no model attached, nothing to hang on.
 *
 * Both are just `LLMProvider` adapters; the core is unchanged.
 */

const hash = (s: string) => createHash("sha1").update(s).digest("hex");

const keyGenerate = (question: string) => `generateCode:${hash(question)}`;
const keyRepair = (code: string, traceback: string) => `repairCode:${hash(`${code}\n--\n${traceback}`)}`;
const keyInterpret = (question: string, stdout: string) => `interpret:${hash(`${question}\n--\n${stdout}`)}`;

export type Cassette = Record<string, string>;

export function loadCassette(path: string): Cassette {
  return JSON.parse(readFileSync(path, "utf8")) as Cassette;
}

export function saveCassette(path: string, cassette: Cassette): void {
  writeFileSync(path, `${JSON.stringify(cassette, null, 2)}\n`);
}

/** Wraps a live provider and records every answer into a cassette object. */
export class RecordingLLMProvider implements LLMProvider {
  constructor(
    private readonly inner: LLMProvider,
    private readonly cassette: Cassette,
  ) {}

  async generateCode(question: string, context: CodeGenContext): Promise<string> {
    const answer = await this.inner.generateCode(question, context);
    this.cassette[keyGenerate(question)] = answer;
    return answer;
  }

  async repairCode(code: string, traceback: string, context: CodeGenContext): Promise<string> {
    const answer = await this.inner.repairCode(code, traceback, context);
    this.cassette[keyRepair(code, traceback)] = answer;
    return answer;
  }

  async interpret(question: string, stdout: string): Promise<string> {
    const answer = await this.inner.interpret(question, stdout);
    this.cassette[keyInterpret(question, stdout)] = answer;
    return answer;
  }
}

/** Serves recorded answers; throws on a miss so a stale demo fails loudly. */
export class ReplayLLMProvider implements LLMProvider {
  constructor(private readonly cassette: Cassette) {}

  private get(key: string, what: string): string {
    const value = this.cassette[key];
    if (value === undefined) {
      throw new Error(`cassette miss for ${what} — re-record the demo cassette`);
    }
    return value;
  }

  async generateCode(question: string): Promise<string> {
    return this.get(keyGenerate(question), `generateCode(${question})`);
  }

  async repairCode(code: string, traceback: string): Promise<string> {
    return this.get(keyRepair(code, traceback), "repairCode");
  }

  async interpret(question: string, stdout: string): Promise<string> {
    return this.get(keyInterpret(question, stdout), `interpret(${question})`);
  }
}
