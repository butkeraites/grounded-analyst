"use client";

import { useState } from "react";

const EMAIL = "rbritobut@gmail.com";

export function CompareNotes() {
  const [copied, setCopied] = useState(false);

  async function handleClick() {
    try {
      await navigator.clipboard.writeText(EMAIL);
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    } catch {
      /* clipboard blocked — the mailto below still fires */
    }
    // Best-effort: open a mail client if one is registered. Harmless no-op otherwise.
    window.location.href = `mailto:${EMAIL}?subject=Comparing%20notes`;
  }

  return (
    <div className="mt-6 flex flex-col items-center gap-2">
      <button
        onClick={handleClick}
        className="inline-block rounded-lg border border-line px-5 py-2.5 text-sm font-medium text-ink/80 transition hover:border-ink/30"
      >
        {copied ? "Copied — email me →" : "Compare notes →"}
      </button>
      <a href={`mailto:${EMAIL}`} className="text-xs text-ink/40 hover:text-ink/70">
        {EMAIL}
      </a>
    </div>
  );
}
