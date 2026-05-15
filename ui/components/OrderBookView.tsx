"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { CLOB_HOST } from "@/lib/polymarket";
import { cn } from "@/lib/cn";

const REFRESH_MS = 5_000;
const DEPTH = 8;

type Level = { price: string; size: string };
type Book = {
  bids: Level[];
  asks: Level[];
  timestamp?: string;
};

type Outcome = "yes" | "no";

type Props = {
  /** Conditional-token id for the YES outcome. */
  tokenYes: string | null;
  /** Conditional-token id for the NO outcome. */
  tokenNo: string | null;
};

async function fetchBook(tokenId: string): Promise<Book> {
  const r = await fetch(
    `${CLOB_HOST}/book?token_id=${encodeURIComponent(tokenId)}`,
    { cache: "no-store" },
  );
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}

export function OrderBookView({ tokenYes, tokenNo }: Props) {
  const [outcome, setOutcome] = useState<Outcome>("yes");
  const [book, setBook] = useState<Book | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const tokenId = outcome === "yes" ? tokenYes : tokenNo;

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    async function load() {
      if (!tokenId) {
        setBook(null);
        return;
      }
      setLoading(true);
      try {
        const b = await fetchBook(tokenId);
        if (!cancelled) {
          setBook(b);
          setErr(null);
        }
      } catch (e) {
        if (!cancelled) setErr((e as Error).message);
      } finally {
        if (!cancelled) {
          setLoading(false);
          timer = setTimeout(load, REFRESH_MS);
        }
      }
    }
    load();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [tokenId]);

  // Per Polymarket convention both sides are sorted with the WORST price first
  // and the inside-of-book at `length - 1`. Take the top `DEPTH` closest to the
  // spread on each side, then orient each side so the spread sits in the middle.
  const { topBids, topAsks, maxCum } = useMemo(() => {
    if (!book) return { topBids: [], topAsks: [], maxCum: 1 };
    // Best `DEPTH` asks: lowest prices, sit just above the spread. In display
    // order we want WORST ask at the top → BEST ask at the bottom (closer to mid).
    const asks = book.asks.slice(-DEPTH);
    // Best `DEPTH` bids: highest prices, sit just below the spread. In display
    // order we want BEST bid at the top → WORST bid at the bottom.
    const bids = book.bids.slice(-DEPTH).reverse();

    // Cumulative depth on each side, separately, used to render the background bars.
    let cumA = 0;
    const asksDecorated = asks.map((lvl) => {
      cumA += parseFloat(lvl.size);
      return { ...lvl, cum: cumA };
    });
    let cumB = 0;
    const bidsDecorated = bids.map((lvl) => {
      cumB += parseFloat(lvl.size);
      return { ...lvl, cum: cumB };
    });
    const max = Math.max(cumA, cumB, 1);
    return { topAsks: asksDecorated, topBids: bidsDecorated, maxCum: max };
  }, [book]);

  const bestBid =
    book && book.bids.length > 0 ? parseFloat(book.bids[book.bids.length - 1].price) : null;
  const bestAsk =
    book && book.asks.length > 0 ? parseFloat(book.asks[book.asks.length - 1].price) : null;
  const spread = bestAsk != null && bestBid != null ? bestAsk - bestBid : null;
  const mid = bestAsk != null && bestBid != null ? (bestAsk + bestBid) / 2 : null;

  if (!tokenYes && !tokenNo) return null;

  return (
    <section className="rounded-md border border-border bg-surface/40 p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wider text-muted-2">
          Order book
          {loading ? <Loader2 className="h-3 w-3 animate-spin opacity-60" /> : null}
        </h2>
        <div className="inline-flex rounded-md border border-border-strong bg-background p-0.5">
          <SideToggle
            active={outcome === "yes"}
            tone="emerald"
            onClick={() => setOutcome("yes")}
            label="YES"
          />
          <SideToggle
            active={outcome === "no"}
            tone="rose"
            onClick={() => setOutcome("no")}
            label="NO"
          />
        </div>
      </div>

      {err ? (
        <p className="text-[12px] text-rose-300">Couldn&apos;t load book: {err}</p>
      ) : !book ? (
        <p className="text-[12px] text-muted">Loading book…</p>
      ) : topAsks.length === 0 && topBids.length === 0 ? (
        <p className="text-[12px] text-muted">No resting orders.</p>
      ) : (
        <div className="overflow-hidden rounded border border-border/60 bg-background/40">
          <Header />
          {topAsks.map((lvl, i) => (
            <Row
              key={`a-${i}`}
              price={parseFloat(lvl.price)}
              size={parseFloat(lvl.size)}
              cum={lvl.cum}
              max={maxCum}
              tone="ask"
            />
          ))}
          <Spread mid={mid} spread={spread} />
          {topBids.map((lvl, i) => (
            <Row
              key={`b-${i}`}
              price={parseFloat(lvl.price)}
              size={parseFloat(lvl.size)}
              cum={lvl.cum}
              max={maxCum}
              tone="bid"
            />
          ))}
        </div>
      )}

      <p className="mt-2 text-[10px] text-muted-2">
        Live book from <span className="font-mono">{CLOB_HOST}</span>. Refreshes
        every {REFRESH_MS / 1000} s. Size is in shares; total cost = size × price.
      </p>
    </section>
  );
}

function Header() {
  return (
    <div className="grid grid-cols-[1fr_1fr_1fr] gap-2 border-b border-border/60 px-3 py-1 text-[10px] uppercase tracking-wider text-muted-2">
      <span>Price</span>
      <span className="text-right">Size</span>
      <span className="text-right">Cumul.</span>
    </div>
  );
}

function Row({
  price,
  size,
  cum,
  max,
  tone,
}: {
  price: number;
  size: number;
  cum: number;
  max: number;
  tone: "bid" | "ask";
}) {
  const pct = Math.min(100, (cum / max) * 100);
  const bg =
    tone === "bid"
      ? "bg-emerald-500/15"
      : "bg-rose-500/15";
  const fg = tone === "bid" ? "text-emerald-300" : "text-rose-300";
  return (
    <div className="relative grid grid-cols-[1fr_1fr_1fr] gap-2 px-3 py-1 text-[12px]">
      <span
        aria-hidden
        className={cn("absolute inset-y-0 left-0", bg)}
        style={{ width: `${pct}%` }}
      />
      <span className={cn("relative tabular font-medium", fg)}>
        {price.toFixed(4)}
      </span>
      <span className="relative tabular text-right text-foreground/90">
        {fmtSize(size)}
      </span>
      <span className="relative tabular text-right text-muted">
        {fmtSize(cum)}
      </span>
    </div>
  );
}

function Spread({
  mid,
  spread,
}: {
  mid: number | null;
  spread: number | null;
}) {
  return (
    <div className="grid grid-cols-2 gap-2 border-y border-border/60 bg-surface/30 px-3 py-1 text-[11px] text-muted">
      <span>
        Mid <span className="tabular text-foreground">{mid != null ? mid.toFixed(4) : "—"}</span>
      </span>
      <span className="text-right">
        Spread{" "}
        <span className="tabular text-foreground">
          {spread != null ? spread.toFixed(4) : "—"}
        </span>
      </span>
    </div>
  );
}

function SideToggle({
  active,
  tone,
  onClick,
  label,
}: {
  active: boolean;
  tone: "emerald" | "rose";
  onClick: () => void;
  label: string;
}) {
  const activeClass =
    tone === "emerald"
      ? "bg-emerald-500/15 text-emerald-200 ring-emerald-400/40"
      : "bg-rose-500/15 text-rose-200 ring-rose-400/40";
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "rounded px-2 py-0.5 text-[11px] font-semibold ring-1 ring-transparent",
        active ? activeClass : "text-muted hover:text-foreground",
      )}
    >
      {label}
    </button>
  );
}

function fmtSize(n: number): string {
  if (!isFinite(n)) return "—";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  if (n >= 100) return n.toFixed(0);
  return n.toFixed(2);
}
