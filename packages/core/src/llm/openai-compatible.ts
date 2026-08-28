import type { LLMConfig } from "../types.js";
import type { CodeGenContext, LLMProvider } from "./provider.js";

/**
 * The OpenAI-compatible LLM adapter — the lingua franca that covers OpenAI,
 * Ollama, LM Studio, vLLM, Groq, Together, … by pointing `baseUrl` at their
 * `/v1` endpoint. With a local Ollama it keeps the platform 100% local while
 * answering arbitrary questions the seeded cassette doesn't cover.
 *
 * Prompts are deliberately strict: code responses must be runnable Python over
 * `df` (no prose, no fences), and interpretations must be grounded only in the
 * executed stdout — never a number the code didn't produce.
 */

function schemaLines(context: CodeGenContext): string {
  return context.profile.columns
    .map((c) => `- ${c.name} (${c.dtype}) e.g. ${c.sample.slice(0, 3).map(String).join(", ")}`)
    .join("\n");
}

/** Strip markdown fences / stray prose a model may wrap code in. */
function extractCode(text: string): string {
  const fence = /```(?:python)?\s*([\s\S]*?)```/i.exec(text);
  return (fence?.[1] ?? text).trim();
}

const CODE_SYSTEM =
  "You are a Python data analyst. You are given a pandas DataFrame already loaded as `df`, " +
  "plus `pd`, `np`, and `plt` (matplotlib, non-interactive). Write Python that answers the " +
  "question by computing over `df`. Rules: output ONLY runnable Python — no prose, no markdown " +
  "fences. print() the key figures so they can be interpreted. If a chart helps, create one with " +
  "matplotlib. If a tabular result helps, assign it to a variable named `result` (a DataFrame). " +
  "Never fabricate data; only use `df`.";

export class OpenAICompatibleLLMProvider implements LLMProvider {
  constructor(private readonly config: LLMConfig) {}

  private async chat(messages: Array<{ role: string; content: string }>): Promise<string> {
    const res = await fetch(`${this.config.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(this.config.apiKey ? { Authorization: `Bearer ${this.config.apiKey}` } : {}),
      },
      body: JSON.stringify({ model: this.config.model, messages, temperature: 0.1, stream: false }),
    });
    if (!res.ok) {
      throw new Error(`LLM request failed (${res.status}): ${await res.text()}`);
    }
    const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const content = data.choices?.[0]?.message?.content;
    if (!content) throw new Error("LLM returned no content");
    return content;
  }

  async generateCode(question: string, context: CodeGenContext): Promise<string> {
    const content = await this.chat([
      { role: "system", content: CODE_SYSTEM },
      {
        role: "user",
        content: `DataFrame \`${context.dataframeVar}\` columns:\n${schemaLines(context)}\n\nQuestion: ${question}`,
      },
    ]);
    return extractCode(content);
  }

  async repairCode(code: string, traceback: string, context: CodeGenContext): Promise<string> {
    const content = await this.chat([
      { role: "system", content: CODE_SYSTEM },
      {
        role: "user",
        content:
          `This code raised an error. Return a corrected version (Python only).\n\n` +
          `Columns:\n${schemaLines(context)}\n\nCode:\n${code}\n\nTraceback:\n${traceback}`,
      },
    ]);
    return extractCode(content);
  }

  async interpret(question: string, stdout: string): Promise<string> {
    return this.chat([
      {
        role: "system",
        content:
          "You explain a data analysis result to a business reader in 2-4 sentences. Ground your " +
          "answer STRICTLY in the program output below — cite the actual numbers, and never invent " +
          "a figure that isn't there.",
      },
      { role: "user", content: `Question: ${question}\n\nProgram output:\n${stdout}` },
    ]);
  }
}
