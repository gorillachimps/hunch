"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { X, Loader2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { useClobSession } from "@/lib/useClobSession";
import { useBalanceAllowance, fmtCollateral } from "@/lib/useBalanceAllowance";
import { placeLimitOrder, Side } from "@/lib/polymarket";
import { useFocusTrap } from "@/lib/useFocusTrap";
import { track } from "@/lib/track";
import { cn } from "@/lib/cn";
import type { TableRow } from "@/lib/types";

type Outcome = "yes" | "no";

type Props = {
  open: boolean;
  market: TableRow | null;
  initialOutcome: Outcome;
  onClose: () => void;
};

const TICK_SIZES = ["0.0001", "0.001", "0.01", "0.1"] as const;
type TickStr = (typeof TICK_SIZES)[number];

function tickToString(t: number | null): TickStr {
  // Snap to the closest supported tick size; default to 0.01 if missing.
  if (t == null) return "0.01";
  const s = t.toString();
  return (TICK_SIZES.includes(s as TickStr) ? s : "0.01") as TickStr;
}

export function OrderTicket({ open, market, initialOutcome, onClose }: Props) {
  const session = useClobSession();
  const allowance = useBalanceAllowance(session.client);

  const [outcome, setOutcome] = useState<Outcome>(initialOutcome);
  const [priceStr, setPriceStr] = useState("");
  const [sizeStr, setSizeStr] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [book, setBook] = useState<{ bid: number | null; ask: number | null }>(
    { bid: null, ask: null },
  );
  const dialogRef = useRef<HTMLDivElement>(null);

  useFocusTrap(open, dialogRef, 'input[inputmode="decimal"]');

  useEffect(() => {
    if (open && market) {
      setOutcome(initialOutcome);
      const implied = market.impliedYes ?? 0.5;
      const start = initialOutcome === "yes" ? implied : 1 - implied;
      setPriceStr(start ? Math.max(0.01, Math.min(0.99, start)).toFixed(2) : "0.50");
      setSizeStr("");
      setBook({ bid: null, ask: null });
    }
  }, [open, market, initialOutcome]);

  // Close on Escape (in addition to overlay click)
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // Pull the live order book for the chosen outcome so the user can snap
  // their limit price to bid / mid / ask without leaving the ticket.
  useEffect(() => {
    if (!open || !market || !session.client) {
      setBook({ bid: null, ask: null });
      return;
    }
    const tokenId = outcome === "yes" ? market.tokenYes : market.tokenNo;
    if (!tokenId) return;
    let cancelled = false;
    (async () => {
      try {
        const ob = await session.client!.getOrderBook(tokenId);
        if (cancelled) return;
        // Polymarket's book convention: both bids AND asks are returned with
        // the worst price first and the inside-of-book at index `length-1`.
        // bids ascending (0.01, 0.02, …, top-bid), asks descending (0.99, 0.98,
        // …, top-ask). So `length-1` is the inside on both sides. Don't swap.
        const topBid = parseFloat(ob.bids?.[ob.bids.length - 1]?.price ?? "");
        const topAsk = parseFloat(ob.asks?.[ob.asks.length - 1]?.price ?? "");
        setBook({
          bid: isFinite(topBid) ? topBid : null,
          ask: isFinite(topAsk) ? topAsk : null,
        });
      } catch {
        if (!cancelled) setBook({ bid: null, ask: null });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, market, outcome, session.client]);

  const tickSize = market ? tickToString(market.tickSize) : "0.01";
  const tickNumeric = parseFloat(tickSize);

  const price = parseFloat(priceStr);
  const sizeUsd = parseFloat(sizeStr);
  const sharesNumeric =
    isFinite(price) && price > 0 && isFinite(sizeUsd) && sizeUsd > 0
      ? sizeUsd / price
      : 0;

  const errors = useMemo(() => {
    const list: string[] = [];
    if (!isFinite(price) || price <= 0 || price >= 1) {
      list.push("Price must be between 0 and 1.");
    } else {
      // Snap-check against tickSize
      const ratio = price / tickNumeric;
      if (Math.abs(ratio - Math.round(ratio)) > 1e-6) {
        list.push(`Price must be a multiple of ${tickSize}.`);
      }
    }
    if (!isFinite(sizeUsd) || sizeUsd <= 0) {
      list.push("Size must be > $0.");
    } else if (sizeUsd < 1) {
      // Polymarket's typical minimum
      list.push("Polymarket minimum order is $1.");
    }
    return list;
  }, [price, sizeUsd, tickNumeric, tickSize]);

  if (!open || !market) return null;

  const tokenId = outcome === "yes" ? market.tokenYes : market.tokenNo;
  const canSubmit =
    session.status === "ready" &&
    session.client !== null &&
    !!tokenId &&
    errors.length === 0 &&
    !submitting;

  async function submit() {
    if (!session.client || !tokenId || !market) return;
    setSubmitting(true);
    const toastId = toast.loading(
      `Placing ${outcome.toUpperCase()} order at ${priceStr}…`,
    );
    try {
      const resp = await placeLimitOrder({
        client: session.client,
        tokenID: tokenId,
        price,
        size: sharesNumeric,
        side: Side.BUY,
        tickSize,
        negRisk: market.negRisk,
      });
      // SDK returns the gateway response; success flag lives on the body.
      if (resp && typeof resp === "object" && resp.success === false) {
        throw new Error(resp.errorMsg || "order rejected");
      }
      toast.success(
        `${outcome.toUpperCase()} order placed (${sharesNumeric.toFixed(2)} shares @ $${priceStr})`,
        { id: toastId, duration: 6000 },
      );
      track("order_placed", {
        outcome,
        slug: market.slug,
        family: market.family,
        size_usd: sizeUsd,
        price,
      });
      allowance.refresh();
      onClose();
    } catch (e) {
      const msg = (e as Error).message ?? "unknown error";
      toast.error(`Order failed: ${msg}`, { id: toastId, duration: 8000 });
      track("order_failed", {
        outcome,
        slug: market.slug,
        family: market.family,
        reason: msg.slice(0, 80),
      });
    } finally {
      setSubmitting(false);
    }
  }

  const sessionBlocker = (() => {
    switch (session.status) {
      case "disabled":
        return "Trading isn't configured (NEXT_PUBLIC_PRIVY_APP_ID missing).";
      case "loading":
        return "Authenticating…";
      case "unconnected":
        return "Connect a wallet first (top-right).";
      case "no-funder":
        return "Set your deposit wallet first (Connect menu → Set deposit wallet).";
      case "deriving":
        return "Deriving Polymarket API credentials…";
      case "error":
        return session.error ?? "Auth error";
      case "ready":
        return null;
    }
  })();

  const allowanceBlocker = (() => {
    if (session.status !== "ready") return null;
    if (allowance.loading || allowance.error) return null;
    if (!allowance.hasAnyAllowance) {
      return "Deposit-wallet allowance is 0 — approve at polymarket.com first.";
    }
    // Guard against the user not having typed a size yet: parseFloat("") is
    // NaN, and BigInt(NaN) throws synchronously during render. Treat unknown
    // size as the $1 minimum so the check still does something useful.
    const sizeForCheck =
      Number.isFinite(sizeUsd) && sizeUsd > 0
        ? Math.max(1, Math.ceil(sizeUsd))
        : 1;
    if (
      allowance.balance != null &&
      allowance.balance < BigInt(sizeForCheck * 1_000_000)
    ) {
      return `Insufficient pUSD balance (${fmtCollateral(allowance.balance)}).`;
    }
    return null;
  })();

  const blocker = sessionBlocker ?? allowanceBlocker;
  const submitDisabled = !canSubmit || !!blocker;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="order-ticket-title"
      className="fixed inset-0 z-50 grid place-items-center bg-black/60 px-4"
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-lg border border-border-strong bg-surface p-4 shadow-2xl sm:p-5"
      >
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <h2 id="order-ticket-title" className="text-base font-semibold tracking-tight">
              Place order
            </h2>
            <p className="mt-1 line-clamp-2 text-[12px] text-muted">
              {market.question}
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

        <div className="grid grid-cols-2 gap-2">
          <SideButton
            active={outcome === "yes"}
            tone="emerald"
            onClick={() => setOutcome("yes")}
            label="Yes"
            sub={market.impliedYes != null ? `${(market.impliedYes * 100).toFixed(0)}¢` : "—"}
          />
          <SideButton
            active={outcome === "no"}
            tone="rose"
            onClick={() => setOutcome("no")}
            label="No"
            sub={
              market.impliedYes != null
                ? `${((1 - market.impliedYes) * 100).toFixed(0)}¢`
                : "—"
            }
          />
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <Input
            label="Limit price"
            value={priceStr}
            onChange={setPriceStr}
            suffix={`tick ${tickSize}`}
            placeholder="0.50"
            inputMode="decimal"
          />
          <Input
            label="Size (USD)"
            value={sizeStr}
            onChange={setSizeStr}
            prefix="$"
            placeholder="5.00"
            inputMode="decimal"
          />
        </div>

        <PriceQuickRow
          tick={tickNumeric}
          bid={book.bid}
          ask={book.ask}
          onPick={(p) => setPriceStr(p.toFixed(decimalsForTick(tickNumeric)))}
        />

        <div className="mt-3 grid grid-cols-2 gap-3 text-[12px] text-muted">
          <Field label="Shares" value={sharesNumeric > 0 ? sharesNumeric.toFixed(2) : "—"} />
          <Field
            label="pUSD balance"
            value={fmtCollateral(allowance.balance)}
          />
        </div>

        {errors.length > 0 ? (
          <ul className="mt-3 space-y-1 text-[12px] text-rose-300">
            {errors.map((e, i) => (
              <li key={i} className="flex items-start gap-1.5">
                <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" aria-hidden="true" />
                {e}
              </li>
            ))}
          </ul>
        ) : null}

        {blocker ? (
          <div className="mt-3 rounded-md border border-amber-400/30 bg-amber-500/10 px-3 py-2 text-[12px] text-amber-200">
            {blocker}
          </div>
        ) : null}

        <div className="mt-4 flex items-center justify-between text-[11px] text-muted-2">
          <span>
            Builder code: <span className="font-mono">SombreroStepover</span>
          </span>
          <span>
            0% fee · Polygon
          </span>
        </div>

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
            onClick={submit}
            disabled={submitDisabled}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-[13px] font-semibold disabled:cursor-not-allowed disabled:opacity-50",
              outcome === "yes"
                ? "border-emerald-400/40 bg-emerald-500/15 text-emerald-200 hover:bg-emerald-500/25"
                : "border-rose-400/40 bg-rose-500/15 text-rose-200 hover:bg-rose-500/25",
            )}
          >
            {submitting ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
            ) : null}
            {submitting ? "Placing…" : `Buy ${outcome.toUpperCase()}`}
          </button>
        </div>
      </div>
    </div>
  );
}

function SideButton({
  active,
  tone,
  onClick,
  label,
  sub,
}: {
  active: boolean;
  tone: "emerald" | "rose";
  onClick: () => void;
  label: string;
  sub: string;
}) {
  const colours = active
    ? tone === "emerald"
      ? "border-emerald-400/60 bg-emerald-500/15 text-emerald-200"
      : "border-rose-400/60 bg-rose-500/15 text-rose-200"
    : "border-border-strong bg-surface text-muted hover:bg-surface-2";
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "flex flex-col items-center gap-0.5 rounded-md border py-2 text-[13px] font-semibold",
        colours,
      )}
    >
      {label}
      <span className="tabular text-[11px] opacity-70">{sub}</span>
    </button>
  );
}

function Input({
  label,
  value,
  onChange,
  prefix,
  suffix,
  placeholder,
  inputMode = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  prefix?: string;
  suffix?: string;
  placeholder?: string;
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[10px] uppercase tracking-wider text-muted-2">
        {label}
      </span>
      <span className="relative">
        {prefix ? (
          <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-[12px] text-muted-2">
            {prefix}
          </span>
        ) : null}
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          inputMode={inputMode}
          spellCheck={false}
          autoComplete="off"
          className={cn(
            "w-full rounded-md border border-border-strong bg-background py-1.5 font-mono text-[13px] text-foreground placeholder:text-muted-2 focus:outline-none focus:ring-2 focus:ring-accent/40",
            prefix ? "pl-6" : "pl-3",
            suffix ? "pr-16" : "pr-3",
          )}
        />
        {suffix ? (
          <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[10px] uppercase text-muted-2">
            {suffix}
          </span>
        ) : null}
      </span>
    </label>
  );
}

function decimalsForTick(t: number): number {
  if (t >= 1) return 0;
  if (t >= 0.1) return 1;
  if (t >= 0.01) return 2;
  if (t >= 0.001) return 3;
  return 4;
}

function snapToTick(p: number, tick: number): number {
  return Math.round(p / tick) * tick;
}

function PriceQuickRow({
  tick,
  bid,
  ask,
  onPick,
}: {
  tick: number;
  bid: number | null;
  ask: number | null;
  onPick: (p: number) => void;
}) {
  const mid = bid != null && ask != null ? (bid + ask) / 2 : null;
  const fmt = (p: number) => p.toFixed(decimalsForTick(tick));
  const Pill = ({
    label,
    value,
  }: {
    label: string;
    value: number | null;
  }) => (
    <button
      type="button"
      disabled={value == null}
      onClick={() => value != null && onPick(snapToTick(value, tick))}
      className="inline-flex items-center gap-1 rounded-md border border-border-strong bg-surface px-2 py-0.5 text-[11px] font-medium text-muted hover:bg-surface-2 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
      title={value == null ? "Order book unavailable" : `Snap to ${fmt(value)}`}
    >
      <span className="text-[10px] uppercase tracking-wider text-muted-2">
        {label}
      </span>
      <span className="tabular text-foreground/90">
        {value != null ? fmt(value) : "—"}
      </span>
    </button>
  );

  return (
    <div className="mt-2 flex items-center gap-2">
      <Pill label="Bid" value={bid} />
      <Pill label="Mid" value={mid} />
      <Pill label="Ask" value={ask} />
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[10px] uppercase tracking-wider text-muted-2">
        {label}
      </span>
      <span className="tabular text-foreground/90">{value}</span>
    </div>
  );
}
