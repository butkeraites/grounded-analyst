"use client";

import { useState } from "react";
import ReactMarkdown from "react-markdown";
import type { Artifact, Message } from "./types";

/** Markdown interpretation, styled without the typography plugin. */
function Prose({ children }: { children: string }) {
  return (
    <div className="space-y-2 leading-relaxed text-ink/90">
      <ReactMarkdown
        components={{
          p: ({ children }) => <p>{children}</p>,
          strong: ({ children }) => <strong className="font-semibold text-ink">{children}</strong>,
          ul: ({ children }) => <ul className="list-disc space-y-1 pl-5">{children}</ul>,
          ol: ({ children }) => <ol className="list-decimal space-y-1 pl-5">{children}</ol>,
          h1: ({ children }) => <h3 className="text-base font-semibold">{children}</h3>,
          h2: ({ children }) => <h3 className="text-base font-semibold">{children}</h3>,
          h3: ({ children }) => <h4 className="font-semibold">{children}</h4>,
          code: ({ children }) => <code className="rounded bg-ink/5 px-1 py-0.5 font-mono text-[0.85em]">{children}</code>,
          a: ({ children, href }) => (
            <a href={href} className="text-accent underline-offset-2 hover:underline">{children}</a>
          ),
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}

function CopyButton({ text, label = "Copy" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => {
        navigator.clipboard?.writeText(text).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 1200);
        });
      }}
      className="text-ink/40 transition hover:text-ink"
    >
      {copied ? "Copied ✓" : label}
    </button>
  );
}

function ChartArtifact({ artifact }: { artifact: Extract<Artifact, { kind: "chart" }> }) {
  const src = `data:${artifact.mimeType};base64,${artifact.data}`;
  return (
    <figure className="overflow-hidden rounded-lg border border-ink/10 bg-surface">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img alt="Generated chart" src={src} className="max-w-full" />
      <figcaption className="flex justify-end border-t border-ink/10 px-3 py-1.5 text-xs">
        <a href={src} download="chart.png" className="text-ink/40 hover:text-ink">
          Download PNG
        </a>
      </figcaption>
    </figure>
  );
}

function toCsv(columns: string[], rows: Array<Array<string | number | boolean | null>>): string {
  const esc = (v: unknown) => {
    const s = String(v ?? "");
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [columns.map(esc).join(","), ...rows.map((r) => r.map(esc).join(","))].join("\n");
}

function TableArtifact({ artifact }: { artifact: Extract<Artifact, { kind: "table" }> }) {
  const csvHref = `data:text/csv;charset=utf-8,${encodeURIComponent(toCsv(artifact.columns, artifact.rows))}`;
  return (
    <div className="overflow-hidden rounded-lg border border-ink/10 bg-surface">
      <div className="max-h-80 overflow-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-surface">
            <tr className="text-left text-xs uppercase tracking-wide text-ink/40">
              {artifact.columns.map((c) => (
                <th key={c} className="border-b border-ink/10 px-3 py-2 font-medium">{c}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {artifact.rows.slice(0, 200).map((row, i) => (
              <tr key={i} className="border-t border-ink/5">
                {row.map((cell, j) => (
                  <td key={j} className="px-3 py-2 tabular-nums text-ink/80">{String(cell)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex justify-end border-t border-ink/10 px-3 py-1.5 text-xs">
        <a href={csvHref} download="table.csv" className="text-ink/40 hover:text-ink">
          Download CSV
        </a>
      </div>
    </div>
  );
}

export function AssistantTurn({ message }: { message: Extract<Message, { role: "assistant" }> }) {
  const [showCode, setShowCode] = useState(false);

  if (message.error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
        {message.error}
      </div>
    );
  }

  if (!message.result) {
    if (message.streamed) {
      return (
        <div>
          <Prose>{message.streamed}</Prose>
          <span className="ml-0.5 animate-pulse text-accent">▍</span>
        </div>
      );
    }
    return (
      <div className="flex items-center gap-2 text-sm text-ink/50">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent" />
        {message.status ?? "Thinking…"}
      </div>
    );
  }

  const { result } = message;
  const charts = result.artifacts.filter((a): a is Extract<Artifact, { kind: "chart" }> => a.kind === "chart");
  const tables = result.artifacts.filter((a): a is Extract<Artifact, { kind: "table" }> => a.kind === "table");

  return (
    <div className="space-y-4">
      <Prose>{result.interpretation}</Prose>
      {charts.map((c, i) => <ChartArtifact key={i} artifact={c} />)}
      {tables.map((t, i) => <TableArtifact key={i} artifact={t} />)}

      <div className="flex items-center gap-4 text-xs">
        <button
          onClick={() => setShowCode((v) => !v)}
          className="text-ink/50 underline-offset-4 hover:text-ink hover:underline"
        >
          {showCode ? "Hide code" : "Show code"}
          {result.repairAttempts > 0 && ` · ${result.repairAttempts} repair${result.repairAttempts > 1 ? "s" : ""}`}
        </button>
        {showCode && <CopyButton text={result.code} label="Copy code" />}
      </div>
      {showCode && (
        <pre className="overflow-x-auto rounded-lg border border-ink/10 bg-ink/[0.03] p-4 font-mono text-xs leading-relaxed text-ink/80">
          {result.code}
        </pre>
      )}
    </div>
  );
}
