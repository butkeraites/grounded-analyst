"use client";

import { useEffect, useRef, useState } from "react";
import { AssistantTurn } from "./AssistantTurn";
import { ProfilePreview } from "./ProfilePreview";
import type { Dataset, Message } from "./types";

const PHASE_LABEL: Record<string, string> = {
  generating: "Writing Python…",
  executing: "Running it in the sandbox…",
  repairing: "Hit an error — repairing the code…",
  interpreting: "Interpreting the results…",
};

let idSeq = 0;
const nextId = () => `m${++idSeq}`;

export function Workspace() {
  const [dataset, setDataset] = useState<Dataset | null>(null);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [conversationId, setConversationId] = useState<string | undefined>();
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [loadingDataset, setLoadingDataset] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-load the seeded sample so the page is useful in one click.
  useEffect(() => {
    fetch("/api/seed")
      .then((r) => r.json())
      .then((d) => {
        setDataset(d.dataset);
        setSuggestions(d.suggestions);
      })
      .catch(() => {})
      .finally(() => setLoadingDataset(false));
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function onUpload(file: File) {
    setLoadingDataset(true);
    setMessages([]);
    setConversationId(undefined);
    const form = new FormData();
    form.append("file", file);
    const res = await fetch("/api/datasets", { method: "POST", body: form });
    const d = await res.json();
    setDataset(d.dataset);
    setSuggestions(d.suggestions);
    setLoadingDataset(false);
  }

  async function ask(question: string) {
    if (!dataset || busy) return;
    setBusy(true);
    setInput("");
    const assistantId = nextId();
    setMessages((m) => [
      ...m,
      { id: nextId(), role: "user", content: question },
      { id: assistantId, role: "assistant", status: "Thinking…" },
    ]);

    const patch = (fn: (msg: Extract<Message, { role: "assistant" }>) => Extract<Message, { role: "assistant" }>) =>
      setMessages((m) => m.map((x) => (x.id === assistantId && x.role === "assistant" ? fn(x) : x)));

    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ datasetId: dataset.id, question, conversationId }),
      });
      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const chunks = buffer.split("\n\n");
        buffer = chunks.pop() ?? "";
        for (const chunk of chunks) {
          const evt = /event: (.*)/.exec(chunk)?.[1];
          const data = /data: (.*)/s.exec(chunk)?.[1];
          if (!evt || !data) continue;
          const payload = JSON.parse(data);
          if (evt === "phase") patch((x) => ({ ...x, status: PHASE_LABEL[payload.phase] ?? "Working…" }));
          else if (evt === "token") patch((x) => ({ ...x, status: undefined, streamed: (x.streamed ?? "") + payload.chunk }));
          else if (evt === "result") patch((x) => ({ ...x, status: undefined, result: payload }));
          else if (evt === "error") patch((x) => ({ ...x, status: undefined, error: payload.message }));
        }
      }
      // conversationId comes back on the result event.
      setMessages((m) => {
        const done = m.find((x) => x.id === assistantId);
        if (done?.role === "assistant" && done.result) setConversationId(done.result.conversationId);
        return m;
      });
    } catch (err) {
      patch((x) => ({ ...x, status: undefined, error: err instanceof Error ? err.message : String(err) }));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto grid min-h-screen max-w-3xl grid-rows-[auto_1fr_auto] gap-6 px-6 py-8">
      <header className="flex items-baseline justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-widest text-accent">Julius clone</p>
          <h1 className="text-lg font-semibold tracking-tight">AI data analyst</h1>
        </div>
        <label className="cursor-pointer text-sm text-ink/60 hover:text-ink">
          <input
            type="file"
            accept=".csv"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && onUpload(e.target.files[0])}
          />
          <span className="rounded-md border border-ink/15 px-3 py-1.5">📎 Upload CSV</span>
        </label>
      </header>

      <main className="space-y-6 overflow-y-auto">
        {loadingDataset && <p className="text-sm text-ink/50">Loading sample dataset…</p>}
        {dataset && <ProfilePreview dataset={dataset} />}

        {dataset && messages.length === 0 && (
          <div>
            <p className="mb-2 text-xs uppercase tracking-wide text-ink/40">Try asking</p>
            <div className="flex flex-wrap gap-2">
              {suggestions.map((q) => (
                <button
                  key={q}
                  onClick={() => ask(q)}
                  className="rounded-full border border-ink/15 px-3 py-1.5 text-sm text-ink/70 transition hover:border-accent hover:text-accent"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="space-y-6">
          {messages.map((m) =>
            m.role === "user" ? (
              <div key={m.id} className="flex justify-end">
                <div className="max-w-lg rounded-2xl rounded-br-sm bg-ink px-4 py-2 text-sm text-paper">
                  {m.content}
                </div>
              </div>
            ) : (
              <AssistantTurn key={m.id} message={m} />
            ),
          )}
          <div ref={bottomRef} />
        </div>
      </main>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (input.trim()) ask(input.trim());
        }}
        className="flex items-center gap-2"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={!dataset || busy}
          placeholder={dataset ? "Ask a question about your data…" : "Upload a dataset to begin"}
          className="flex-1 rounded-lg border border-ink/15 bg-white px-4 py-2.5 text-sm outline-none focus:border-accent disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={!dataset || busy || !input.trim()}
          className="rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-white disabled:opacity-40"
        >
          {busy ? "…" : "Ask"}
        </button>
      </form>
    </div>
  );
}
