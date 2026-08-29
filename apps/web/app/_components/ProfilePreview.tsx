import type { Dataset } from "./types";

const DTYPE_LABEL: Record<string, string> = {
  integer: "int",
  float: "float",
  boolean: "bool",
  datetime: "date",
  categorical: "category",
  string: "text",
};

/** A column-profile table — types, missing counts, and samples, at a glance. */
export function ProfilePreview({ dataset }: { dataset: Dataset }) {
  return (
    <div className="rounded-lg border border-ink/10 bg-surface">
      <div className="flex items-baseline justify-between px-4 py-3">
        <span className="font-medium">{dataset.name}</span>
        <span className="text-xs text-ink/50">
          {dataset.profile.rowCount.toLocaleString()} rows · {dataset.profile.columns.length} columns
        </span>
      </div>
      <div className="overflow-x-auto border-t border-ink/10">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wide text-ink/40">
              <th className="px-4 py-2 font-medium">Column</th>
              <th className="px-4 py-2 font-medium">Type</th>
              <th className="px-4 py-2 font-medium">Nulls</th>
              <th className="px-4 py-2 font-medium">Sample</th>
            </tr>
          </thead>
          <tbody>
            {dataset.profile.columns.map((c) => (
              <tr key={c.name} className="border-t border-ink/5">
                <td className="px-4 py-2 font-medium">{c.name}</td>
                <td className="px-4 py-2">
                  <span className="rounded bg-ink/5 px-1.5 py-0.5 font-mono text-xs text-ink/70">
                    {DTYPE_LABEL[c.dtype] ?? c.dtype}
                  </span>
                </td>
                <td className="px-4 py-2 text-ink/60">{c.nullCount}</td>
                <td className="max-w-xs truncate px-4 py-2 text-ink/50">
                  {c.sample.slice(0, 4).map(String).join(", ")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
