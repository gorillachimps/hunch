"use client";

import { useEffect, useRef } from "react";
import { ArrowUpRight, X } from "lucide-react";
import { useFocusTrap } from "@/lib/useFocusTrap";

// USDC.e on Polygon — the canonical collateral token Polymarket accepts.
const POLYGON_USDC_E = "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174";
const POLYGON_CHAIN_ID = "137";

type Props = {
  open: boolean;
  /** Recipient address (the user's Polymarket account on Polygon). Pre-filled
   *  inside the bridge widget so a careless paste-and-forget can't send funds
   *  to the wrong account. */
  toAddress: `0x${string}` | null | undefined;
  onClose: () => void;
};

/**
 * Embedded USDC bridge dialog.
 *
 * Iframes Jumper.exchange (LI.FI's hosted UI) with destination chain, token,
 * and recipient address pre-filled in the URL. The user gets a modal-feel
 * "Hunch is bridging your funds" experience without us shipping the
 * ~500 KB-plus LI.FI widget npm package — which v3 forces alongside Solana,
 * Sui, and Bitcoin wallet stacks at import time.
 *
 * Trade-offs vs the native @lifi/widget integration we tried first:
 *   - Pro: zero bundle, zero peer-dep wrangling, audited UI we don't have to
 *          maintain. Users land on a familiar bridge UX.
 *   - Con: the iframe has its own wallet flow (Jumper doesn't share Hunch's
 *          Privy session). Users may reconnect their wallet inside the
 *          iframe — that's expected and matches the way Jumper.exchange
 *          works as a standalone app.
 *
 * If we ever need tighter integration (post-bridge auto-detection of the
 * incoming USDC arrival, custom slippage UX, etc.) the call-sites for
 * BridgeButton stay identical when we swap this internals for option C
 * (custom UI on the LI.FI SDK).
 */
export function BridgeDialog({ open, toAddress, onClose }: Props) {
  const dialogRef = useRef<HTMLDivElement>(null);
  useFocusTrap(open, dialogRef);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const params = new URLSearchParams({
    toChain: POLYGON_CHAIN_ID,
    toToken: POLYGON_USDC_E,
  });
  if (toAddress) params.set("toAddress", toAddress);
  const iframeSrc = `https://jumper.exchange/?${params.toString()}`;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="bridge-dialog-title"
      className="fixed inset-0 z-50 grid place-items-center bg-black/60 px-4 py-6 overflow-y-auto"
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        onClick={(e) => e.stopPropagation()}
        className="flex w-full max-w-[500px] flex-col rounded-lg border border-border-strong bg-surface shadow-2xl"
      >
        <div className="flex items-start justify-between gap-3 border-b border-border px-4 py-3 sm:px-5">
          <div>
            <h2
              id="bridge-dialog-title"
              className="text-base font-semibold tracking-tight"
            >
              Bridge USDC to your trading account
            </h2>
            <p className="mt-1 text-[12px] text-muted">
              From any chain → Polygon USDC.e. Quotes by LI.FI; bridge handled
              by Stargate, Across, Hop or similar depending on the best route.
            </p>
          </div>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="grid h-7 w-7 shrink-0 place-items-center rounded text-muted hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <iframe
          src={iframeSrc}
          title="LI.FI bridge to your Polymarket account"
          // sandbox excludes `allow-top-navigation` so the iframe can't
          // navigate the parent away. Wallet popups still work because
          // `allow-popups` is granted.
          sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox allow-forms"
          allow="clipboard-write *; clipboard-read *; payment *"
          className="h-[680px] w-full bg-background"
        />

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border px-4 py-2 text-[10px] text-muted-2 sm:px-5">
          <span>
            Hunch never sees or holds your funds. The bridge executes
            peer-to-peer via your wallet signature.
          </span>
          <a
            href={iframeSrc}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-muted hover:text-foreground"
            title="Open the bridge in a new tab if the embed has trouble"
          >
            Open in new tab
            <ArrowUpRight className="h-3 w-3" aria-hidden="true" />
          </a>
        </div>
      </div>
    </div>
  );
}
