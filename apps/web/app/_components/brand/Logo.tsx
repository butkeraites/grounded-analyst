/** BIS logo mark — a glowing coral circle on a navy tile (from the BIS design system). */
export function LogoMark({ size = 36 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 44 44"
      fill="none"
      aria-hidden="true"
      style={{ filter: "drop-shadow(0 6px 14px rgba(255,71,87,.22))" }}
    >
      <rect x="1" y="1" width="42" height="42" rx="12" fill="#111a2c" />
      <rect x="1.5" y="1.5" width="41" height="41" rx="11.5" fill="none" stroke="rgba(255,255,255,.10)" />
      <circle cx="22" cy="21" r="12" fill="#ff4757" opacity="0.22" />
      <circle cx="22" cy="21" r="8" fill="#ff4757" />
    </svg>
  );
}

/** BIS wordmark, with an optional "Intelligent Solutions" sub-label. */
export function Logo({ height = 26, sub = false }: { height?: number; sub?: boolean }) {
  return (
    <span className="inline-flex items-center gap-3">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/bis-logo.png"
        alt="BIS — Butkeraites Intelligent Solutions"
        style={{ height, width: "auto", display: "block" }}
      />
      {sub && (
        <span className="border-l border-line pl-3 text-[10px] font-bold uppercase tracking-[0.15em] text-muted">
          Intelligent Solutions
        </span>
      )}
    </span>
  );
}
