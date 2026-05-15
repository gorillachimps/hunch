"use client";

import { useEffect, useState, useMemo } from "react";
import { Loader2, RefreshCw, Wallet, AlertCircle, ExternalLink } from "lucide-react";
import { useClobSession } from "@/lib/useClobSession";
import { cn } from "@/lib/cn";

const REFRESH_MS = 30_000;
const POSITIONS_HOST = "https://data-api.polymarket.com";

type Position = {
  proxyWallet: string;
  asset: string;
  conditionId: string;
  size: number;
  avgPrice: number;
  initialValue: number;
  currentValue: number;
  cashPnl: number;
  percentPnl: number;
  totalBought: number;
  realizedPnl: number;
  curPrice: number;
  redeemable: boolean;
  mergeable: boolean;
  title: string;
  slug: string;
  icon?: string;
  eventSlug?: string;
  outcome: string;
  outcomeIndex: number;
  endDate?: string;
  negativeRisk?: boolean;
};

type State = {
  positions: Position[] | null;
  loading: boolean;
  error: string | null;
};

const ZERO: State = { positions: null, loading: false, error: null };

function fmtUSD(n: number): string {
  if (!isFinite(n)) return "—";
  if (Math.abs(n) < 0.01) return "$0.00";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: Math.abs(n) >= 1000 ? 0 : 2,
  }).format(n);
}

function fmtSignedUSD(n: number): { text: string; sign: 1 | 0 | -1 } {
  if (!isFinite(n) || Math.abs(n) < 0.005) return { text: "$0.00", sign: 0 };
  return { text: fmtUSD(n), sign: n > 0 ? 1 : -1 };
}

function fmtPct(n: number): string {
  if (!isFinite(n) || Math.abs(n) < 0.05) return "—";
  return `${n > 0 ? "+" : ""}${n.toFixed(1)}%`;
}

function fmtDate(iso: string | undefined): string {
  if (!iso) return "—";
  const t = Date.parse(iso);
  if (!isFinite(t)) return iso;
  const ms = t - Date.now();
  if (ms <= 0) return "ended";
  const d = Math.floor(ms / 86_400_000);
  if (d < 1) return "<1d";
  return `${d}d`;
}

export function PortfolioView() {
  const session = useClobSession();
  const funder = session.funderAddress;
  const [state, setState] = useState<State>(ZERO);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    async function load() {
      if (!funder) {
        setState(ZERO);
        return;
      }
      setState((s) => ({ ...s, loading: true, error: null }));
      try {
        const url = `${POSITIONS_HOST}/positions?user=${funder}&sizeThreshold=0`;
        const r = await fetch(url, { cache: "no-store" });
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const data = await r.json();
        if (cancelled) return;
        const positions: Position[] = Array.isArray(data) ? data : [];
        setState({ positions, loading: false, error: null });
      } catch (e) {
        if (cancelled) return;
        setState({
          positions: null,
          loading: false,
          error: (e as Error).message,
        });
      } finally {
        if (!cancelled) timer = setTimeout(load, REFRESH_MS);
      }
    }

    load();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [funder]);

  const summary = useMemo(() => {
    if (!state.positions) return null;
    let count = 0;
    let totalValue = 0;
    let totalPnl = 0;
    let redeemable = 0;
    for (const p of state.positions) {
      count++;
      if (isFinite(p.currentValue)) totalValue += p.currentValue;
      if (isFinite(p.cashPnl)) totalPnl += p.cashPnl;
      if (p.redeemable) redeemable++;
    }
    return { count, totalValue, totalPnl, redeemable };
  }, [state.positions]);

  if (session.status === "disabled") {
    return (
      <Empty
        title="Trading not configured"
        body="Set NEXT_PUBLIC_PRIVY_APP_ID to enable wallet features."
      />
    );
  }
  if (session.status === "loading") {
    return <Empty title="Loading…" body="Privy is initialising." />;
  }
  if (session.status === "unconnected") {
    return (
      <Empty
        title="Wallet not connected"
        body="Connect a wallet from the top-right to see your Polymarket positions."
      />
    );
  }
  if (session.status === "no-funder") {
    return (
      <Empty
        title="Deposit wallet missing"
        body="Set your deposit-wallet address from the Connect menu."
      />
    );
  }
  if (state.loading && !state.positions) {
    return (
      <Empty
        title="Fetching positions…"
        body="Querying the Polymarket data API."
        icon={<Loader2 className="h-5 w-5 animate-spin text-accent" />}
      />
    );
  }
  if (state.error) {
    return (
      <Empty
        title="Couldn't fetch positions"
        body={state.error}
        tone="error"
      />
    );
  }
  if (!state.positions || state.positions.length === 0) {
    return (
      <Empty
        title="No open positions"
        body="Place a YES / NO order from the screener and any filled shares will appear here. Closed-out positions (net zero) don't show — only currently-held outcomes do."
      />
    );
  }

  return (
    <div className="mt-6">
      <div className="mb-3 flex flex-wrap items-center gap-3 rounded-md border border-border bg-surface/40 px-3 py-2">
        {summary ? (
          <>
            <Stat label="Positions" value={summary.count.toLocaleString()} />
            <span className="text-border-strong" aria-hidden="true">·</span>
            <Stat label="Mark value" value={fmtUSD(summary.totalValue)} />
            <span className="text-border-strong" aria-hidden="true">·</span>
            <Stat
              label="Unrealised P&L"
              value={fmtSignedUSD(summary.totalPnl).text}
              tone={
                summary.totalPnl > 0
                  ? "emerald"
                  : summary.totalPnl < 0
                    ? "rose"
                    : "neutral"
              }
            />
            {summary.redeemable > 0 ? (
              <>
                <span className="text-border-strong" aria-hidden="true">·</span>
                <Stat
                  label="Redeemable"
                  value={`${summary.redeemable}`}
                  tone="emerald"
                  hint="settled markets, ready to claim"
                />
              </>
            ) : null}
          </>
        ) : null}
        <div className="ml-auto">
          <button
            type="button"
            onClick={() => {
              setState((s) => ({ ...s, loading: true }));
              // re-run effect by toggling: easiest is to reload-once via direct fetch
              fetch(`${POSITIONS_HOST}/positions?user=${funder}&sizeThreshold=0`)
                .then((r) => r.json())
                .then((d) =>
                  setState({
                    positions: Array.isArray(d) ? d : [],
                    loading: false,
                    error: null,
                  }),
                )
                .catch((e) =>
                  setState({
                    positions: state.positions,
                    loading: false,
                    error: (e as Error).message,
                  }),
                );
            }}
            disabled={state.loading}
            className="inline-flex items-center gap-1 rounded-md border border-border-strong bg-surface px-2 py-1 text-[11px] font-medium text-muted hover:bg-surface-2 hover:text-foreground disabled:opacity-50"
          >
            {state.loading ? (
              <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
            ) : (
              <RefreshCw className="h-3 w-3" aria-hidden="true" />
            )}
            Refresh
          </button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-md border border-border bg-surface/20">
        <table className="w-full min-w-[1080px] border-separate border-spacing-0 text-sm">
          <thead>
            <tr>
              <Th>Market</Th>
              <Th>Side</Th>
              <Th>Shares</Th>
              <Th>Avg</Th>
              <Th>Current</Th>
              <Th>Value</Th>
              <Th>P&L</Th>
              <Th>Closes</Th>
              <Th />
            </tr>
          </thead>
          <tbody>
            {state.positions.map((p) => {
              const isYes = p.outcome.toLowerCase() === "yes";
              const pnl = fmtSignedUSD(p.cashPnl);
              return (
                <tr
                  key={`${p.conditionId}-${p.asset}`}
                  className="border-b border-border hover:bg-surface/40"
                >
                  <Td>
                    <a
                      href={`/markets/${p.slug}`}
                      className="block max-w-[26rem] truncate text-[12px] text-foreground hover:text-accent hover:underline"
                      title={p.title}
                    >
                      {p.title}
                    </a>
                  </Td>
                  <Td>
                    <span
                      className={cn(
                        "rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ring-1",
                        isYes
                          ? "bg-emerald-500/15 text-emerald-200 ring-emerald-400/30"
                          : "bg-rose-500/15 text-rose-200 ring-rose-400/30",
                      )}
                    >
                      {p.outcome}
                    </span>
                    {p.redeemable ? (
                      <span className="ml-1 rounded bg-amber-500/15 px-1.5 py-0.5 text-[9px] font-bold uppercase text-amber-200 ring-1 ring-amber-400/30">
                        redeem
                      </span>
                    ) : null}
                  </Td>
                  <Td>
                    <span className="tabular text-foreground">
                      {p.size.toFixed(2)}
                    </span>
                  </Td>
                  <Td>
                    <span className="tabular text-[12px] text-muted">
                      {p.avgPrice > 0 ? `$${p.avgPrice.toFixed(3)}` : "—"}
                    </span>
                  </Td>
                  <Td>
                    <span className="tabular text-foreground">
                      ${p.curPrice.toFixed(3)}
                    </span>
                  </Td>
                  <Td>
                    <span className="tabular text-foreground">
                      {fmtUSD(p.currentValue)}
                    </span>
                  </Td>
                  <Td>
                    <div className="flex flex-col leading-tight">
                      <span
                        className={cn(
                          "tabular text-[12px] font-medium",
                          pnl.sign > 0
                            ? "text-emerald-300"
                            : pnl.sign < 0
                              ? "text-rose-300"
                              : "text-muted",
                        )}
                      >
                        {pnl.sign > 0 ? "+" : ""}
                        {pnl.text}
                      </span>
                      <span className="tabular text-[10px] text-muted-2">
                        {fmtPct(p.percentPnl)}
                      </span>
                    </div>
                  </Td>
                  <Td>
                    <span className="tabular text-[12px] text-muted">
                      {fmtDate(p.endDate)}
                    </span>
                  </Td>
                  <Td>
                    <a
                      href={`https://polymarket.com/event/${p.slug}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-0.5 rounded text-[11px] text-muted hover:text-foreground"
                      title="Open on Polymarket"
                    >
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </Td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-[11px] text-muted-2">
        Data via{" "}
        <code className="font-mono">data-api.polymarket.com/positions</code>.
        Mark value uses the live mid price; actual sell proceeds depend on the
        order book.
      </p>
    </div>
  );
}

function Empty({
  title,
  body,
  icon,
  tone = "neutral",
}: {
  title: string;
  body: string;
  icon?: React.ReactNode;
  tone?: "neutral" | "error";
}) {
  return (
    <div className="mt-8 flex flex-col items-center gap-3 rounded-md border border-border bg-surface/40 px-6 py-12 text-center">
      <span
        className={cn(
          "grid h-10 w-10 place-items-center rounded-full ring-1",
          tone === "error"
            ? "bg-rose-500/15 ring-rose-400/30"
            : "bg-zinc-700/40 ring-zinc-500/40",
        )}
      >
        {icon ??
          (tone === "error" ? (
            <AlertCircle className="h-5 w-5 text-rose-300" />
          ) : (
            <Wallet className="h-5 w-5 text-muted" />
          ))}
      </span>
      <h2 className="text-base font-semibold">{title}</h2>
      <p className="max-w-md text-sm text-muted">{body}</p>
    </div>
  );
}

function Stat({
  label,
  value,
  hint,
  tone = "neutral",
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "neutral" | "emerald" | "rose";
}) {
  const colour =
    tone === "emerald"
      ? "text-emerald-300"
      : tone === "rose"
        ? "text-rose-300"
        : "text-foreground";
  return (
    <div className="flex flex-col leading-tight">
      <span className="text-[10px] uppercase tracking-wider text-muted-2">
        {label}
      </span>
      <span className={cn("tabular text-[13px] font-semibold", colour)}>
        {value}
      </span>
      {hint ? (
        <span className="tabular text-[10px] text-muted-2">{hint}</span>
      ) : null}
    </div>
  );
}

function Th({ children }: { children?: React.ReactNode }) {
  return (
    <th
      scope="col"
      className="border-b border-border bg-surface/40 px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-muted"
    >
      {children}
    </th>
  );
}

function Td({ children }: { children: React.ReactNode }) {
  return (
    <td className="border-b border-border/70 px-3 py-2 align-middle">
      {children}
    </td>
  );
}
