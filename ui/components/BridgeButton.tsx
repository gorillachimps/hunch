"use client";

import { ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/cn";

// USDC.e on Polygon — the canonical collateral token Polymarket accepts.
const POLYGON_USDC_E = "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174";

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
 * Bridge USDC into a Polymarket trading account.
 *
 * Hands off to Jumper.exchange (LI.FI's hosted bridge UI) with the destination
 * chain (Polygon), token (USDC.e), and recipient address pre-selected. Opens
 * in a new tab so the user keeps Hunch open behind.
 *
 * Why an external hand-off rather than an embedded widget:
 *   1. Zero integrator config — no API keys, no bundle hit (~500KB+ avoided)
 *   2. The user lands on a familiar, audited UI for the actual fund movement
 *   3. Easy to swap to an embedded widget later without changing call sites
 */
export function BridgeButton({
  toAddress,
  variant = "primary",
  label,
  className,
}: Props) {
  const params = new URLSearchParams({
    toChain: "137",
    toToken: POLYGON_USDC_E,
  });
  if (toAddress) params.set("toAddress", toAddress);
  const href = `https://jumper.exchange/?${params.toString()}`;

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
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(base, stylesByVariant[variant], className)}
      title="Opens Jumper.exchange in a new tab"
    >
      {label ?? "Bridge USDC"}
      <ArrowUpRight className="h-3 w-3" aria-hidden="true" />
    </a>
  );
}
