"use client";

import { useEffect, useRef, useState } from "react";
import { ExternalLink, X } from "lucide-react";
import { writeFunderAddress } from "@/lib/polymarket";
import { useFocusTrap } from "@/lib/useFocusTrap";
import { BridgeButton } from "./BridgeButton";

type Props = {
  open: boolean;
  eoa: `0x${string}` | undefined;
  currentFunder: `0x${string}` | null;
  onClose: () => void;
  onSaved: (funder: `0x${string}`) => void;
};

export function DepositWalletDialog({
  open,
  eoa,
  currentFunder,
  onClose,
  onSaved,
}: Props) {
  const [value, setValue] = useState(currentFunder ?? "");
  const [error, setError] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  useFocusTrap(open, dialogRef, 'input[type="text"]');

  useEffect(() => {
    if (!open) return;
    setValue(currentFunder ?? "");
    setError(null);
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, currentFunder, onClose]);

  if (!open) return null;

  const isValid = /^0x[0-9a-fA-F]{40}$/.test(value.trim());

  function save() {
    const trimmed = value.trim();
    if (!/^0x[0-9a-fA-F]{40}$/.test(trimmed)) {
      setError("Address must look like 0x followed by 40 hex characters.");
      return;
    }
    if (!eoa) {
      setError("Connect a wallet first.");
      return;
    }
    if (trimmed.toLowerCase() === eoa.toLowerCase()) {
      setError(
        "That's your connected wallet, not your Polymarket account address. Find the account (proxy) address at polymarket.com → settings → Builder Codes → Address.",
      );
      return;
    }
    writeFunderAddress(eoa, trimmed as `0x${string}`);
    onSaved(trimmed as `0x${string}`);
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="deposit-wallet-title"
      className="fixed inset-0 z-50 grid place-items-center bg-black/60 px-4"
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-lg border border-border-strong bg-surface p-5 shadow-2xl"
      >
        <div className="mb-3 flex items-start justify-between">
          <h2 id="deposit-wallet-title" className="text-base font-semibold tracking-tight">
            Connect your trading account
          </h2>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="grid h-7 w-7 place-items-center rounded text-muted hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <p className="text-[12px] leading-relaxed text-muted">
          One-time setup. Hunch never custodies funds — your wallet signs every
          order and trades route through your existing{" "}
          <a
            href="https://polymarket.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-accent hover:underline"
          >
            Polymarket
          </a>{" "}
          account. Paste your account address below and you&apos;re done.
        </p>

        <div className="mt-3 flex flex-col gap-1 rounded-md border border-border bg-surface-2/40 px-3 py-2 text-[11px] text-muted">
          <span className="text-foreground">Don&apos;t have one yet?</span>
          <a
            href="https://polymarket.com"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-accent hover:underline"
          >
            Create a Polymarket account first <ExternalLink className="h-3 w-3" />
          </a>
        </div>

        <a
          href="https://polymarket.com/settings?tab=builder"
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 inline-flex items-center gap-1 text-[12px] text-accent hover:underline"
        >
          Find your account address <ExternalLink className="h-3 w-3" />
        </a>

        <label className="mt-4 block text-[10px] uppercase tracking-wider text-muted-2">
          Polymarket account address
        </label>
        <input
          type="text"
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setError(null);
          }}
          spellCheck={false}
          autoComplete="off"
          placeholder="0x..."
          className="mt-1 w-full rounded-md border border-border-strong bg-background px-3 py-2 font-mono text-[12px] text-foreground placeholder:text-muted-2 focus:outline-none focus:ring-2 focus:ring-accent/40"
        />
        {error ? (
          <p className="mt-2 text-[12px] text-rose-300">{error}</p>
        ) : null}

        {isValid ? (
          <div className="mt-3 flex items-start justify-between gap-3 rounded-md border border-border bg-surface-2/40 px-3 py-2">
            <div className="text-[11px] text-muted">
              <div className="text-foreground">Need USDC in your account?</div>
              <div className="mt-0.5 text-muted-2">
                Bridge from any chain — Jumper sends it straight to your trading
                account on Polygon.
              </div>
            </div>
            <BridgeButton
              toAddress={value.trim() as `0x${string}`}
              variant="secondary"
              label="Bridge"
            />
          </div>
        ) : null}

        <div className="mt-4 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-border-strong bg-surface px-3 py-1.5 text-[13px] font-medium text-muted hover:bg-surface-2 hover:text-foreground"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={save}
            disabled={!isValid}
            className="rounded-md border border-accent/40 bg-accent/15 px-3 py-1.5 text-[13px] font-medium text-accent hover:bg-accent/25 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
