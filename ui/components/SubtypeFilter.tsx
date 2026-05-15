"use client";

import { cn } from "@/lib/cn";
import { SUBTYPE_CHIPS, FAMILY_TONE_CLASSES } from "@/lib/families";
import type { Family } from "@/lib/types";

type Props = {
  active: Family | "all";
  onChange: (next: Family | "all") => void;
  counts: Partial<Record<Family | "all", number>>;
};

export function SubtypeFilter({ active, onChange, counts }: Props) {
  return (
    <div role="group" aria-label="Subtype filter" className="flex flex-wrap items-center gap-1.5">
      {SUBTYPE_CHIPS.map((chip) => {
        const isActive = active === chip.family;
        const tone = FAMILY_TONE_CLASSES[chip.tone];
        const n = counts[chip.family] ?? 0;
        return (
          <button
            key={chip.family}
            type="button"
            onClick={() => onChange(chip.family)}
            aria-pressed={isActive}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-medium ring-1 transition-colors",
              isActive
                ? chip.family === "all"
                  ? "bg-foreground text-background ring-foreground"
                  : "bg-accent-strong text-white ring-accent-strong shadow-[0_0_0_1px_rgba(167,139,250,0.4)]"
                : tone + " hover:brightness-125",
            )}
          >
            <span>{chip.label}</span>
            <span
              className={cn(
                "tabular text-[10px]",
                isActive ? "opacity-80" : "opacity-60",
              )}
            >
              {n.toLocaleString()}
            </span>
          </button>
        );
      })}
    </div>
  );
}
