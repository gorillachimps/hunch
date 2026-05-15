"use client";

import { useId, useState, type ReactNode } from "react";
import { Info } from "lucide-react";
import { cn } from "@/lib/cn";

type Props = {
  label: ReactNode;
  hint: ReactNode;
  side?: "top" | "bottom";
  align?: "start" | "center" | "end";
  className?: string;
};

/** Lightweight, dependency-free tooltip. Shows on hover and on keyboard focus
 *  via a focusable Info icon — so screen readers and keyboard users can reach
 *  the explanatory text without relying on hover. */
export function Tooltip({
  label,
  hint,
  side = "bottom",
  align = "start",
  className,
}: Props) {
  const id = useId();
  const [open, setOpen] = useState(false);

  return (
    <span className={cn("relative inline-flex items-center gap-1", className)}>
      <span>{label}</span>
      <button
        type="button"
        aria-label="What does this mean?"
        aria-describedby={open ? id : undefined}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onClick={(ev) => {
          ev.stopPropagation();
          setOpen((o) => !o);
        }}
        className="grid h-3.5 w-3.5 place-items-center rounded text-muted-2 hover:text-foreground focus-visible:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent/60"
      >
        <Info className="h-3 w-3" />
      </button>
      <span
        id={id}
        role="tooltip"
        className={cn(
          "pointer-events-none absolute z-30 w-64 rounded-md border border-border-strong bg-surface px-3 py-2 text-[11px] font-normal normal-case leading-snug text-foreground/90 tracking-normal shadow-lg transition-opacity",
          open ? "opacity-100" : "opacity-0",
          side === "bottom" ? "top-full mt-2" : "bottom-full mb-2",
          align === "start" && "left-0",
          align === "center" && "left-1/2 -translate-x-1/2",
          align === "end" && "right-0",
        )}
      >
        {hint}
      </span>
    </span>
  );
}
