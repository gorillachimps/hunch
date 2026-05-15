"use client";

import { Star } from "lucide-react";
import { cn } from "@/lib/cn";
import { useStarred } from "@/lib/useStarred";

export function StarToggle({ marketId }: { marketId: string }) {
  const { starred, toggle } = useStarred();
  const isOn = starred.has(marketId);
  return (
    <button
      type="button"
      aria-label={isOn ? "Remove from watchlist" : "Add to watchlist"}
      aria-pressed={isOn}
      onClick={(ev) => {
        ev.stopPropagation();
        toggle(marketId);
      }}
      className="grid h-6 w-6 place-items-center rounded text-muted-2 hover:text-foreground"
    >
      <Star
        className={cn("h-3.5 w-3.5", isOn && "fill-amber-300 text-amber-300")}
        strokeWidth={2}
      />
    </button>
  );
}
