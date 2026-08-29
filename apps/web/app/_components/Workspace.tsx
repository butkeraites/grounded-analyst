"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AssistantTurn } from "./AssistantTurn";
import { ProfilePreview } from "./ProfilePreview";
import type { Dataset, Message } from "./types";

const PHASE_LABEL: Record<string, string> = {
  generating: "Writing Python…",
  executing: "Running it in the sandbox…",
  repairing: "Hit an error — repairing the code…",
  interpreting: "Interpreting the results…",
};

interface ConversationSummary {
  id: string;
  title: string;
  createdAt: string;
}

let idSeq = 0;
const nextId = () => `m${++idSeq}`;

function ago(iso: string): string {
  const s = Math.max(1, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export function Workspace() {
  const [dataset, setDataset] = useState<Dataset | null>(null);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [conversationId, setConversationId] = useState<string | undefined>();
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [loadingDataset, setLoadingDataset] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const loadConversations = () =>
    fetch("/api/conversations")
      .then((r) => r.json())
      .then((d) => setConversations(d.conversations ?? []))
      .catch(() => {});

  useEffect(() => {
    fetch("/api/seed")
      .then((r) => r.json())
      .then((d) => {
        setDataset(d.dataset);
        setSuggestions(d.suggestions);
      })
      .catch(() => {})
      .finally(() => setLoadingDataset(false));
    loadConversations();
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Auto-grow the composer.
  useEffect(() => {
    const ta = taRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = `${Math.min(ta.scrollHeight, 200)}px`;
  }, [input]);

  function newAnalysis() {
    abortRef.current?.abort();
    setMessages([]);
    setConversationId(undefined);
    setInput("");
  }

  async function onUpload(file: File) {
    setLoadingDataset(true);
    newAnalysis();
    const form = new FormData();
    form.append("file", file);
    const res = await fetch("/api/datasets", { method: "POST", body: form });
    const d = await res.json();
    setDataset(d.dataset);
    setSuggestions(d.suggestions ?? []);
    setLoadingDataset(false);
  }

  async function openConversation(id: string) {
    if (id === conversationId) return;
    abortRef.current?.abort();
    const d = await (await fetch(`/api/conversations/${id}`)).json();
    if (d.dataset) setDataset(d.dataset);
    if (d.suggestions) setSuggestions(d.suggestions);
    setMessages(d.messages ?? []);
    setConversationId(id);
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

    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ datasetId: dataset.id, question, conversationId }),
        signal: controller.signal,
      });
      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let newConvId: string | undefined;
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
          else if (evt === "result") {
            newConvId = payload.conversationId;
            patch((x) => ({ ...x, status: undefined, result: payload }));
          } else if (evt === "error") patch((x) => ({ ...x, status: undefined, error: payload.message }));
        }
      }
      if (newConvId && !conversationId) {
        setConversationId(newConvId);
        loadConversations();
      }
    } catch (err) {
      if ((err as Error).name === "AbortError") patch((x) => ({ ...x, status: undefined, streamed: (x.streamed ?? "") + " ⏹ stopped" }));
      else patch((x) => ({ ...x, status: undefined, error: err instanceof Error ? err.message : String(err) }));
    } finally {
      abortRef.current = null;
      setBusy(false);
    }
  }

  const asked = new Set(messages.filter((m) => m.role === "user").map((m) => (m as { content: string }).content));
  const lastDone = messages.length > 0 && messages[messages.length - 1]?.role === "assistant" && "result" in messages[messages.length - 1]!;
  const followUps = suggestions.filter((q) => !asked.has(q)).slice(0, 3);

  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside className="hidden w-64 shrink-0 flex-col border-r border-ink/10 bg-ink/[0.02] px-3 py-4 md:flex">
        <div className="px-2">
          <p className="text-xs font-medium uppercase tracking-widest text-accent">Julius clone</p>
          <p className="text-sm font-semibold tracking-tight">AI data analyst</p>
        </div>
        <button
          onClick={newAnalysis}
          className="mt-4 rounded-md border border-ink/15 bg-white px-3 py-2 text-left text-sm font-medium text-ink/80 hover:border-accent hover:text-accent"
        >
          ＋ New analysis
        </button>
        <div className="mt-4 flex-1 space-y-0.5 overflow-y-auto">
          <p className="px-2 pb-1 text-xs uppercase tracking-wide text-ink/30">History</p>
          {conversations.length === 0 && <p className="px-2 text-xs text-ink/40">No analyses yet.</p>}
          {conversations.map((c) => (
            <button
              key={c.id}
              onClick={() => openConversation(c.id)}
              className={`block w-full truncate rounded-md px-2 py-1.5 text-left text-sm ${
                c.id === conversationId ? "bg-accent/10 text-accent" : "text-ink/70 hover:bg-ink/5"
              }`}
              title={c.title}
            >
              {c.title}
              <span className="ml-1 text-xs text-ink/30">· {ago(c.createdAt)}</span>
            </button>
          ))}
        </div>
        <Link href="/usage" className="mt-2 px-2 text-xs text-ink/40 hover:text-ink">
          Usage &amp; cost →
        </Link>
      </aside>

      {/* Main */}
      <div className="flex min-h-screen flex-1 flex-col">
        <main className="mx-auto w-full max-w-3xl flex-1 space-y-6 overflow-y-auto px-6 py-8">
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
                  <div className="max-w-lg rounded-2xl rounded-br-sm bg-ink px-4 py-2 text-sm text-paper">{m.content}</div>
                </div>
              ) : (
                <AssistantTurn key={m.id} message={m} />
              ),
            )}

            {lastDone && followUps.length > 0 && !busy && (
              <div className="flex flex-wrap gap-2 pt-1">
                {followUps.map((q) => (
                  <button
                    key={q}
                    onClick={() => ask(q)}
                    className="rounded-full border border-ink/10 px-3 py-1.5 text-xs text-ink/60 transition hover:border-accent hover:text-accent"
                  >
                    {q}
                  </button>
                ))}
              </div>
            )}
            <div ref={bottomRef} />
          </div>
        </main>

        {/* Composer */}
        <div className="mx-auto w-full max-w-3xl px-6 pb-6">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (input.trim()) ask(input.trim());
            }}
            className="flex items-end gap-2 rounded-2xl border border-ink/15 bg-white p-2 shadow-sm focus-within:border-accent"
          >
            <label className="cursor-pointer rounded-lg p-2 text-ink/40 hover:bg-ink/5 hover:text-ink" title="Upload a CSV">
              <input
                type="file"
                accept=".csv"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && onUpload(e.target.files[0])}
              />
              📎
            </label>
            <textarea
              ref={taRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  if (input.trim() && !busy) ask(input.trim());
                }
              }}
              rows={1}
              disabled={!dataset}
              placeholder={dataset ? "Ask a question about your data…  (Enter to send)" : "Upload a dataset to begin"}
              className="max-h-52 flex-1 resize-none bg-transparent px-1 py-2 text-sm outline-none disabled:opacity-50"
            />
            {busy ? (
              <button
                type="button"
                onClick={() => abortRef.current?.abort()}
                className="rounded-lg border border-ink/15 px-4 py-2 text-sm font-medium text-ink/70 hover:bg-ink/5"
              >
                Stop
              </button>
            ) : (
              <button
                type="submit"
                disabled={!dataset || !input.trim()}
                className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
              >
                Ask
              </button>
            )}
          </form>
        </div>
      </div>
    </div>
  );
}
