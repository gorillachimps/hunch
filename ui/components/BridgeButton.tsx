"use client";

import { useState } from "react";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/cn";
import { BridgeDialog } from "./BridgeDialog";

type Variant = "primary" | "secondary" | "inline";

type Props = {
  /** Address to bridge funds INTO. When provided, the recipient is pre-filled
   *  in the bridge widget so the user can't accidentally send to the wrong
   *  account. Usually the Polymarket proxy/funder address. */
  toAddress?: `0x${string}` | null;
  /** Visual style. `inline` is a small text-link; the others are buttons. */
  variant?: Variant;
  /** Override the default label. */
  label?: string;
  className?: string;
};

/**
 * Opens the embedded BridgeDialog (LI.FI widget) so the user can fund their
 * Polymarket account without leaving Hunch. The dialog itself is lazy-loaded,
 * so this button costs ~zero bundle until clicked.
 */
export function BridgeButton({
  toAddress,
  variant = "primary",
  label,
  className,
}: Props) {
  const [open, setOpen] = useState(false);

  const base =
    "inline-flex items-center gap-1.5 rounded-md text-[12px] font-semibold transition-colors";
  const stylesByVariant: Record<Variant, string> = {
    primary:
      "border border-accent/40 bg-accent/15 text-accent hover:bg-accent/25 px-3 py-1.5",
    secondary:
      "border border-border-strong bg-surface text-foreground hover:bg-surface-2 px-3 py-1.5",
    inline:
      "text-accent hover:underline text-[12px] font-medium px-0 py-0",
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(base, stylesByVariant[variant], className)}
        title="Bridge USDC from any chain to your Polymarket account"
      >
        {label ?? "Bridge USDC"}
        <ArrowRight className="h-3 w-3" aria-hidden="true" />
      </button>
      <BridgeDialog
        open={open}
        toAddress={toAddress ?? null}
        onClose={() => setOpen(false)}
      />
    </>
  );
}
