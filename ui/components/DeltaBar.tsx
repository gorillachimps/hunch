import { cn } from "@/lib/cn";
import { Check } from "lucide-react";

type Props = {
  /** Signed fractional distance from current value to threshold. e.g. 0.466 = 46.6% away. */
  distance: number | null;
  alreadyTriggered?: boolean;
  /** When `true`, render a muted placeholder for non-live markets. */
  deferred?: boolean;
};

export function DeltaBar({ distance, alreadyTriggered, deferred }: Props) {
  if (deferred || distance == null || !isFinite(distance)) {
    return (
      <div className="flex h-5 items-center text-[11px] text-muted-2">—</div>
    );
  }

  if (alreadyTriggered) {
    return (
      <div className="flex h-5 items-center gap-1.5 rounded-md bg-emerald-500/15 px-2 ring-1 ring-emerald-400/30">
        <Check className="h-3 w-3 text-emerald-300" strokeWidth={3} />
        <span className="text-[11px] font-semibold text-emerald-200">triggered</span>
      </div>
    );
  }

  const pct = distance * 100;
  const abs = Math.min(Math.abs(pct), 100);
  const isPositive = pct >= 0;
  // green = how close we are; red = remaining gap.
  const closeness = 100 - abs;
  const sign = isPositive ? "+" : "−";
  const label = `${sign}${Math.abs(pct).toFixed(pct > 100 ? 0 : 1)}%`;

  return (
    <div className="relative h-5 w-full overflow-hidden rounded-md bg-zinc-800/60 ring-1 ring-border">
      <div
        className={cn(
          "absolute inset-y-0 left-0",
          isPositive ? "bg-emerald-500/35" : "bg-rose-500/30",
        )}
        style={{ width: `${closeness}%` }}
      />
      <div
        className={cn(
          "absolute inset-y-0 right-0",
          isPositive ? "bg-rose-500/30" : "bg-emerald-500/30",
        )}
        style={{ width: `${abs}%` }}
      />
      <div className="absolute inset-0 flex items-center justify-center">
        <span
          className={cn(
            "tabular text-[11px] font-semibold",
            isPositive ? "text-emerald-100" : "text-rose-100",
          )}
        >
          {label}
        </span>
      </div>
    </div>
  );
}
