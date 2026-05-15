"use client";

import { useEffect, useState } from "react";
import { Loader2, Wallet } from "lucide-react";
import { useClobSession } from "@/lib/useClobSession";
import { getBalanceAllowance } from "@/lib/polymarket";
import { cn } from "@/lib/cn";
import type { TableRow } from "@/lib/types";

const REFRESH_MS = 30_000;

type Holdings = {
  yes: number; // shares (6-decimal collateral units → divided by 1e6)
  no: number;
};

function rawToShares(raw: string): number {
  try {
    const n = Number(BigInt(raw));
    return n / 1_000_000;
  } catch {
    return 0;
  }
}

function fmtUSD(n: number): string {
  if (!isFinite(n)) return "—";
  if (Math.abs(n) < 0.01) return "$0.00";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(n);
}

export function PositionCard({ market }: { market: TableRow }) {
  const session = useClobSession();
  const [holdings, setHoldings] = useState<Holdings | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    async function load() {
      if (!session.client || !market.tokenYes || !market.tokenNo) return;
      setLoading(true);
      try {
        const [yesR, noR] = await Promise.all([
          getBalanceAllowance(session.client, market.tokenYes),
          getBalanceAllowance(session.client, market.tokenNo),
        ]);
        if (cancelled) return;
        setHoldings({
          yes: rawToShares(yesR.balance ?? "0"),
          no: rawToShares(noR.balance ?? "0"),
        });
      } catch {
        // ignore — keep previous holdings
      } finally {
        if (!cancelled) {
          setLoading(false);
          timer = setTimeout(load, REFRESH_MS);
        }
      }
    }

    if (session.status === "ready") load();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [session.client, session.status, market.tokenYes, market.tokenNo]);

  // Don't render at all unless we have a session — keeps the page identical
  // for unauthenticated viewers.
  if (session.status !== "ready") return null;
  if (!holdings) {
    return (
      <section className="rounded-md border border-border bg-surface/40 p-4">
        <h2 className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-muted-2">
          Your position
        </h2>
        <div className="flex items-center gap-2 text-[12px] text-muted">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Loading holdings…
        </div>
      </section>
    );
  }

  if (holdings.yes === 0 && holdings.no === 0) {
    return (
      <section className="rounded-md border border-border bg-surface/40 p-4">
        <h2 className="mb-3 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wider text-muted-2">
          <Wallet className="h-3 w-3" />
          Your position
        </h2>
        <p className="text-[12px] text-muted">
          You don&apos;t hold YES or NO shares for this market yet. Use the buttons
          below to place a builder-attributed order.
        </p>
      </section>
    );
  }

  const implied = market.impliedYes ?? 0.5;
  const yesValue = holdings.yes * implied;
  const noValue = holdings.no * (1 - implied);
  const totalValue = yesValue + noValue;

  return (
    <section className="rounded-md border border-border bg-surface/40 p-4">
      <h2 className="mb-3 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wider text-muted-2">
        <Wallet className="h-3 w-3" />
        Your position
        {loading ? <Loader2 className="h-3 w-3 animate-spin opacity-60" /> : null}
      </h2>
      <div className="grid gap-3 sm:grid-cols-3">
        <Side label="YES shares" shares={holdings.yes} value={yesValue} tone="emerald" />
        <Side label="NO shares" shares={holdings.no} value={noValue} tone="rose" />
        <div className="flex flex-col">
          <span className="text-[10px] uppercase tracking-wider text-muted-2">
            Mark-to-market
          </span>
          <span className="tabular text-lg font-semibold text-foreground">
            {fmtUSD(totalValue)}
          </span>
          <span className="text-[10px] text-muted">
            at {(implied * 100).toFixed(0)}% implied
          </span>
        </div>
      </div>
    </section>
  );
}

function Side({
  label,
  shares,
  value,
  tone,
}: {
  label: string;
  shares: number;
  value: number;
  tone: "emerald" | "rose";
}) {
  const colour =
    tone === "emerald" ? "text-emerald-300" : "text-rose-300";
  return (
    <div className="flex flex-col">
      <span className="text-[10px] uppercase tracking-wider text-muted-2">
        {label}
      </span>
      <span className={cn("tabular text-lg font-semibold", colour)}>
        {shares.toFixed(2)}
      </span>
      <span className="text-[10px] text-muted">{fmtUSD(value)} mark</span>
    </div>
  );
}
