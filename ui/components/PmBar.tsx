import { fmtImpliedPct } from "@/lib/format";

type Props = {
  /** Polymarket implied probability of YES, 0..1. */
  impliedYes: number | null;
};

/** Tiny inline bar for the PM column. Shows the implied probability as both
 *  a fill width and an overlaid percentage label, so the column reads at-a-glance
 *  without taking extra vertical space. */
export function PmBar({ impliedYes }: Props) {
  if (impliedYes == null || !isFinite(impliedYes)) {
    return (
      <span className="tabular text-[11px] text-muted-2" aria-hidden="true">
        —
      </span>
    );
  }
  const pct = Math.max(0, Math.min(1, impliedYes)) * 100;
  // Tone shifts subtly with confidence so a 99% market doesn't look like a 1% one.
  // We use a single accent (violet) but darken at the extremes to suggest "decided".
  const decided = pct < 5 || pct > 95;
  return (
    <div
      className="relative h-5 w-full overflow-hidden rounded-md bg-zinc-800/60 ring-1 ring-border"
      role="img"
      aria-label={`Polymarket implied YES probability ${pct.toFixed(0)} percent`}
    >
      <div
        className={
          decided
            ? "absolute inset-y-0 left-0 bg-zinc-500/35"
            : "absolute inset-y-0 left-0 bg-violet-500/35"
        }
        style={{ width: `${pct}%` }}
      />
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="tabular text-[11px] font-semibold text-foreground">
          {fmtImpliedPct(impliedYes)}
        </span>
      </div>
    </div>
  );
}
