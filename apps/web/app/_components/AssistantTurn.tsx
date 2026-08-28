"use client";

import { useState } from "react";
import type { Artifact, Message } from "./types";

function ChartArtifact({ artifact }: { artifact: Extract<Artifact, { kind: "chart" }> }) {
  // eslint-disable-next-line @next/next/no-img-element
  return (
    <img
      alt="Generated chart"
      src={`data:${artifact.mimeType};base64,${artifact.data}`}
      className="max-w-full rounded-lg border border-ink/10 bg-white"
    />
  );
}

function TableArtifact({ artifact }: { artifact: Extract<Artifact, { kind: "table" }> }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-ink/10 bg-white">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs uppercase tracking-wide text-ink/40">
            {artifact.columns.map((c) => (
              <th key={c} className="px-3 py-2 font-medium">{c}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {artifact.rows.slice(0, 50).map((row, i) => (
            <tr key={i} className="border-t border-ink/5">
              {row.map((cell, j) => (
                <td key={j} className="px-3 py-2 tabular-nums text-ink/80">{String(cell)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
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
      <p className="leading-relaxed text-ink/90">{result.interpretation}</p>
      {charts.map((c, i) => <ChartArtifact key={i} artifact={c} />)}
      {tables.map((t, i) => <TableArtifact key={i} artifact={t} />)}

      <div className="text-xs">
        <button
          onClick={() => setShowCode((v) => !v)}
          className="text-ink/50 underline-offset-4 hover:text-ink hover:underline"
        >
          {showCode ? "Hide code" : "Show code"}
          {result.repairAttempts > 0 && ` · ${result.repairAttempts} repair${result.repairAttempts > 1 ? "s" : ""}`}
        </button>
        {showCode && (
          <pre className="mt-2 overflow-x-auto rounded-lg border border-ink/10 bg-ink/[0.03] p-4 font-mono text-xs leading-relaxed text-ink/80">
            {result.code}
          </pre>
        )}
      </div>
    </div>
  );
}
