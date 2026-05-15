"use client";

import {
  Wallet,
  ChevronDown,
  LogOut,
  Settings,
  AlertTriangle,
  ArrowDownToLine,
  ArrowUpRight,
  Loader2,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { usePrivy, useWallets } from "@privy-io/react-auth";
import { isPrivyConfigured } from "@/lib/env-client";
import { readFunderAddress } from "@/lib/polymarket";
import { useClobSession } from "@/lib/useClobSession";
import { DepositWalletDialog } from "./DepositWalletDialog";
import { cn } from "@/lib/cn";

// USDC.e on Polygon for the bridge URL — same value the BridgeButton uses.
const POLYGON_USDC_E = "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174";

function bridgeHref(funder: `0x${string}` | null): string {
  const params = new URLSearchParams({
    toChain: "137",
    toToken: POLYGON_USDC_E,
  });
  if (funder) params.set("toAddress", funder);
  return `https://jumper.exchange/?${params.toString()}`;
}

function shortAddress(a?: string) {
  if (!a) return "";
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

export function ConnectButton() {
  if (!isPrivyConfigured) return <ConnectButtonDisabled />;
  return <ConnectButtonInner />;
}

function ConnectButtonDisabled() {
  return (
    <span
      className="rounded-md border border-border-strong bg-surface px-3 py-1.5 text-[13px] font-medium text-muted-2 opacity-60"
      title="Set NEXT_PUBLIC_PRIVY_APP_ID in .env.local to enable trading"
    >
      Sign in
    </span>
  );
}

function ConnectButtonInner() {
  const { ready, authenticated, login, logout, user } = usePrivy();
  const { wallets } = useWallets();
  const session = useClobSession();
  const eoa = wallets[0]?.address as `0x${string}` | undefined;

  const [menuOpen, setMenuOpen] = useState(false);
  const [funder, setFunder] = useState<`0x${string}` | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  // Reload funder when wallet changes
  useEffect(() => {
    if (!eoa) {
      setFunder(null);
      return;
    }
    setFunder(readFunderAddress(eoa));
  }, [eoa]);

  // Close dropdown on outside click
  useEffect(() => {
    if (!menuOpen) return;
    function onClick(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setMenuOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setMenuOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  if (!ready) {
    return (
      <span
        className="inline-flex items-center gap-2 rounded-md border border-border-strong bg-surface px-3 py-1.5 text-[13px] text-muted"
        aria-label="Auth loading"
      >
        <span className="h-2 w-2 animate-pulse rounded-full bg-muted-2" />
        …
      </span>
    );
  }

  if (!authenticated) {
    return (
      <button
        type="button"
        onClick={() => login()}
        className="inline-flex items-center gap-1.5 rounded-md border border-accent/40 bg-accent/15 px-3 py-1.5 text-[13px] font-medium text-accent hover:bg-accent/25"
      >
        <Wallet className="h-3.5 w-3.5" />
        Connect wallet
      </button>
    );
  }

  const needsFunder = !funder;
  const isDeriving = session.status === "deriving";
  const sessionErrored = session.status === "error";

  let leftBadge: React.ReactNode;
  let borderClass: string;
  let textClass: string;
  if (isDeriving) {
    leftBadge = (
      <Loader2 className="h-3.5 w-3.5 animate-spin text-accent" aria-hidden="true" />
    );
    borderClass = "border-accent/40";
    textClass = "text-accent";
  } else if (sessionErrored) {
    leftBadge = (
      <AlertTriangle className="h-3.5 w-3.5 text-rose-300" aria-hidden="true" />
    );
    borderClass = "border-rose-400/40";
    textClass = "text-rose-200";
  } else if (needsFunder) {
    leftBadge = (
      <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
    );
    borderClass = "border-amber-400/40";
    textClass = "text-amber-200";
  } else {
    leftBadge = (
      <span
        aria-hidden="true"
        className="h-2 w-2 rounded-full bg-emerald-400"
      />
    );
    borderClass = "border-border-strong";
    textClass = "text-foreground";
  }

  return (
    <>
      <div ref={wrapRef} className="relative">
        <button
          type="button"
          onClick={() => setMenuOpen((v) => !v)}
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          aria-busy={isDeriving}
          title={
            isDeriving
              ? "Authenticating with Polymarket… please sign the prompt in your wallet"
              : sessionErrored
                ? `Auth error: ${session.error ?? "unknown"}`
                : undefined
          }
          className={cn(
            "inline-flex items-center gap-2 rounded-md border bg-surface px-2.5 py-1.5 text-[13px] font-medium hover:bg-surface-2",
            borderClass,
            textClass,
          )}
        >
          {leftBadge}
          <span className="font-mono text-[12px]">
            {isDeriving ? "Authorising…" : shortAddress(eoa)}
          </span>
          <ChevronDown className="h-3 w-3 text-muted-2" aria-hidden="true" />
        </button>

        {menuOpen ? (
          <div
            role="menu"
            className="absolute right-0 top-full z-40 mt-1 w-72 overflow-hidden rounded-md border border-border-strong bg-surface text-[13px] shadow-2xl"
          >
            <div className="border-b border-border px-3 py-2">
              <div className="text-[10px] uppercase tracking-wider text-muted-2">
                Signer (EOA)
              </div>
              <div className="font-mono text-[12px] text-foreground">{eoa}</div>
            </div>
            <div className="border-b border-border px-3 py-2">
              <div className="text-[10px] uppercase tracking-wider text-muted-2">
                Deposit wallet (funder)
              </div>
              {funder ? (
                <div className="font-mono text-[12px] text-foreground">
                  {funder}
                </div>
              ) : (
                <div className="text-[12px] text-amber-300">
                  Not set — required for trading
                </div>
              )}
            </div>
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setMenuOpen(false);
                setDialogOpen(true);
              }}
              className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-surface-2"
            >
              <Settings className="h-3.5 w-3.5 text-muted-2" />
              {funder ? "Change deposit wallet" : "Set deposit wallet"}
            </button>
            <a
              href={bridgeHref(funder)}
              target="_blank"
              rel="noopener noreferrer"
              role="menuitem"
              onClick={() => setMenuOpen(false)}
              className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-surface-2"
              title={
                funder
                  ? "Opens Jumper.exchange in a new tab with your Polymarket account pre-filled as the destination"
                  : "Opens Jumper.exchange in a new tab — destination on Polygon USDC.e"
              }
            >
              <ArrowDownToLine className="h-3.5 w-3.5 text-muted-2" />
              <span className="flex-1">Bridge USDC</span>
              {!funder ? (
                <span className="rounded-full bg-amber-500/15 px-1.5 py-0 text-[9px] font-semibold uppercase tracking-wider text-amber-200 ring-1 ring-amber-400/40">
                  no account
                </span>
              ) : (
                <ArrowUpRight className="h-3 w-3 text-muted-2" aria-hidden="true" />
              )}
            </a>
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setMenuOpen(false);
                logout();
              }}
              className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-surface-2"
            >
              <LogOut className="h-3.5 w-3.5 text-muted-2" />
              Disconnect
            </button>
            {user?.email?.address ? (
              <div className="border-t border-border px-3 py-1.5 text-[10px] text-muted-2">
                {user.email.address}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      <DepositWalletDialog
        open={dialogOpen}
        eoa={eoa}
        currentFunder={funder}
        onClose={() => setDialogOpen(false)}
        onSaved={(addr) => {
          setFunder(addr);
          setDialogOpen(false);
        }}
      />
    </>
  );
}
