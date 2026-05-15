"use client";

import { cn } from "@/lib/cn";

type TickerOption = { ticker: string; count: number };

type Props = {
  options: TickerOption[];
  active: string;
  onChange: (next: string) => void;
};

export function TickerChips({ options, active, onChange }: Props) {
  return (
    <div role="group" aria-label="Ticker filter" className="flex flex-wrap items-center gap-1.5">
      <span className="text-[10px] uppercase tracking-wider text-muted-2">
        Ticker:
      </span>
      <button
        type="button"
        onClick={() => onChange("")}
        aria-pressed={active === ""}
        className={cn(
          "rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 transition-colors",
          active === ""
            ? "bg-foreground text-background ring-foreground"
            : "bg-zinc-700/30 text-zinc-200 ring-zinc-500/40 hover:brightness-125",
        )}
      >
        Any
      </button>
      {options.map((o) => {
        const isActive = active === o.ticker;
        return (
          <button
            key={o.ticker}
            type="button"
            onClick={() => onChange(isActive ? "" : o.ticker)}
            aria-pressed={isActive}
            className={cn(
              "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-mono ring-1 transition-colors",
              isActive
                ? "bg-violet-500/20 text-violet-100 ring-violet-400/40"
                : "bg-violet-500/10 text-violet-300 ring-violet-400/25 hover:brightness-125",
            )}
          >
            {o.ticker}
            <span className="tabular text-[10px] opacity-60">{o.count}</span>
          </button>
        );
      })}
    </div>
  );
}
