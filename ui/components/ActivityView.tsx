"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  ExternalLink,
  Loader2,
  RefreshCw,
  Wallet,
} from "lucide-react";
import { useClobSession } from "@/lib/useClobSession";
import { cn } from "@/lib/cn";

const REFRESH_MS = 60_000;
const HOST = "https://data-api.polymarket.com";

type Trade = {
  proxyWallet?: string;
  side: "BUY" | "SELL";
  asset: string; // token id
  conditionId?: string;
  outcome?: string; // "Yes" | "No"
  outcomeIndex?: number; // 0 | 1
  price: number;
  size: number;
  sizeUsdc?: number;
  title?: string;
  slug?: string;
  icon?: string;
  eventSlug?: string;
  transactionHash?: string;
  timestamp: number; // unix seconds (data-api convention)
};

type State = {
  trades: Trade[] | null;
  loading: boolean;
  error: string | null;
};

const ZERO: State = { trades: null, loading: false, error: null };

function fmtUSD(n: number): string {
  if (!isFinite(n) || Math.abs(n) < 0.005) return "$0.00";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: Math.abs(n) >= 1000 ? 0 : 2,
  }).format(n);
}

function fmtSize(n: number): string {
  if (!isFinite(n)) return "—";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  if (n >= 100) return n.toFixed(0);
  return n.toFixed(2);
}

function fmtAge(unixSeconds: number): string {
  const ms = Date.now() - unixSeconds * 1000;
  if (ms < 60_000) return `${Math.max(0, Math.floor(ms / 1000))}s ago`;
  if (ms < 3_600_000) return `${Math.floor(ms / 60_000)}m ago`;
  if (ms < 86_400_000) return `${Math.floor(ms / 3_600_000)}h ago`;
  const d = Math.floor(ms / 86_400_000);
  if (d < 30) return `${d}d ago`;
  return new Date(unixSeconds * 1000).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

export function ActivityView() {
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
        const url = `${HOST}/trades?user=${funder}&limit=200`;
        const r = await fetch(url, { cache: "no-store" });
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const data = await r.json();
        if (cancelled) return;
        const trades: Trade[] = Array.isArray(data) ? data : [];
        // Defensive sort: newest first.
        trades.sort((a, b) => (b.timestamp ?? 0) - (a.timestamp ?? 0));
        setState({ trades, loading: false, error: null });
      } catch (e) {
        if (cancelled) return;
        setState((s) => ({
          trades: s.trades,
          loading: false,
          error: (e as Error).message,
        }));
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
    if (!state.trades) return null;
    let buys = 0;
    let sells = 0;
    let totalUsdc = 0;
    for (const t of state.trades) {
      const usdc = t.sizeUsdc != null ? t.sizeUsdc : t.size * t.price;
      if (isFinite(usdc)) totalUsdc += usdc;
      if (t.side === "BUY") buys++;
      else if (t.side === "SELL") sells++;
    }
    return { count: state.trades.length, buys, sells, totalUsdc };
  }, [state.trades]);

  if (session.status === "loading" || session.status === "deriving") {
    return (
      <Empty>
        <span className="inline-flex items-center gap-2 text-[12px] text-muted">
          <Loader2 className="h-3 w-3 animate-spin" />
          Authenticating…
        </span>
      </Empty>
    );
  }

  if (session.status !== "ready" || !funder) {
    return (
      <Empty
        icon={<Wallet className="h-4 w-4 text-muted-2" aria-hidden="true" />}
        title="Connect a wallet"
        body="Connect from the top-right to see your fill history."
      />
    );
  }

  if (state.loading && !state.trades) {
    return (
      <Empty
        icon={<Loader2 className="h-4 w-4 animate-spin text-muted-2" aria-hidden="true" />}
        title="Fetching trades…"
      />
    );
  }

  if (state.error && !state.trades) {
    return (
      <Empty
        icon={<AlertCircle className="h-4 w-4 text-rose-300" aria-hidden="true" />}
        title="Couldn't fetch trades"
        body={state.error}
      />
    );
  }

  if (!state.trades || state.trades.length === 0) {
    return (
      <Empty
        icon={<Wallet className="h-4 w-4 text-muted-2" aria-hidden="true" />}
        title="No trades yet"
        body="Place a YES / NO order from the screener and any filled shares will appear here."
      />
    );
  }

  return (
    <div className="mt-4">
      {summary ? (
        <div className="mb-3 flex flex-wrap items-center gap-3 rounded-md border border-border bg-surface/40 px-3 py-2 text-[12px]">
          <Stat label="Total fills" value={summary.count.toLocaleString()} />
          <span className="text-border-strong">·</span>
          <Stat
            label="Buys / Sells"
            value={`${summary.buys} / ${summary.sells}`}
          />
          <span className="text-border-strong">·</span>
          <Stat label="Volume traded" value={fmtUSD(summary.totalUsdc)} />
          <div className="ml-auto inline-flex items-center gap-1 text-[10px] uppercase tracking-wider text-muted-2">
            {state.loading ? (
              <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
            ) : (
              <RefreshCw className="h-3 w-3" aria-hidden="true" />
            )}
            <span>Refreshes every {Math.round(REFRESH_MS / 1000)}s</span>
          </div>
        </div>
      ) : null}

      <div className="overflow-x-auto rounded-md border border-border bg-surface/20 scrollbar-thin">
        <table className="w-full min-w-[900px] border-separate border-spacing-0 text-sm">
          <thead>
            <tr>
              <Th>When</Th>
              <Th>Market</Th>
              <Th>Side</Th>
              <Th>Outcome</Th>
              <Th align="right">Price</Th>
              <Th align="right">Shares</Th>
              <Th align="right">USDC</Th>
              <Th align="right">Tx</Th>
            </tr>
          </thead>
          <tbody>
            {state.trades.map((t, i) => {
              const ts = t.timestamp ?? 0;
              const usdc =
                t.sizeUsdc != null ? t.sizeUsdc : t.size * t.price;
              const outcomeText = t.outcome ?? (t.outcomeIndex === 0 ? "Yes" : t.outcomeIndex === 1 ? "No" : "—");
              const isYes = /^yes$/i.test(outcomeText);
              const bullish =
                (t.side === "BUY" && isYes) || (t.side === "SELL" && !isYes);
              const sideTone = bullish
                ? "bg-emerald-500/15 text-emerald-200 ring-emerald-400/30"
                : "bg-rose-500/15 text-rose-200 ring-rose-400/30";
              return (
                <tr
                  key={`${t.transactionHash ?? i}-${t.asset}-${ts}`}
                  className="border-b border-border/70 hover:bg-surface/40"
                >
                  <Td>
                    <span
                      className="tabular text-[12px] text-muted"
                      title={
                        ts > 0
                          ? new Date(ts * 1000).toISOString()
                          : undefined
                      }
                    >
                      {ts > 0 ? fmtAge(ts) : "—"}
                    </span>
                  </Td>
                  <Td>
                    {t.slug && t.title ? (
                      <a
                        href={`/markets/${t.slug}`}
                        className="block max-w-[28rem] truncate text-[12px] text-foreground hover:text-accent hover:underline"
                        title={t.title}
                      >
                        {t.title}
                      </a>
                    ) : (
                      <span
                        className="font-mono text-[11px] text-muted-2"
                        title={t.asset}
                      >
                        {(t.asset ?? "—").slice(0, 14)}…
                      </span>
                    )}
                  </Td>
                  <Td>
                    <span
                      className={cn(
                        "inline-flex items-center rounded px-1.5 py-0 text-[10px] font-bold uppercase tracking-wider ring-1",
                        sideTone,
                      )}
                    >
                      {t.side}
                    </span>
                  </Td>
                  <Td>
                    <span
                      className={cn(
                        "text-[12px] font-medium uppercase",
                        isYes ? "text-emerald-300" : "text-rose-300",
                      )}
                    >
                      {outcomeText}
                    </span>
                  </Td>
                  <Td align="right">
                    <span className="tabular text-foreground/90">
                      ${(t.price ?? 0).toFixed(3)}
                    </span>
                  </Td>
                  <Td align="right">
                    <span className="tabular text-muted">{fmtSize(t.size)}</span>
                  </Td>
                  <Td align="right">
                    <span className="tabular text-foreground/85">
                      {fmtUSD(usdc)}
                    </span>
                  </Td>
                  <Td align="right">
                    {t.transactionHash ? (
                      <a
                        href={`https://polygonscan.com/tx/${t.transactionHash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 font-mono text-[11px] text-muted hover:text-foreground"
                        title={t.transactionHash}
                      >
                        {t.transactionHash.slice(0, 8)}…
                        <ExternalLink className="h-3 w-3" aria-hidden="true" />
                      </a>
                    ) : (
                      <span className="font-mono text-[11px] text-muted-2">—</span>
                    )}
                  </Td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Empty({
  icon,
  title,
  body,
  children,
}: {
  icon?: React.ReactNode;
  title?: string;
  body?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <div className="mt-6 rounded-md border border-border bg-surface/40 px-6 py-12 text-center">
      {icon ? <div className="mb-2 inline-flex">{icon}</div> : null}
      {title ? (
        <h2 className="text-base font-semibold text-foreground">{title}</h2>
      ) : null}
      {body ? (
        <p className="mx-auto mt-1 max-w-md text-sm text-muted">{body}</p>
      ) : null}
      {children}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col leading-tight">
      <span className="text-[10px] uppercase tracking-wider text-muted-2">
        {label}
      </span>
      <span className="tabular text-[13px] font-semibold text-foreground">
        {value}
      </span>
    </div>
  );
}

function Th({
  children,
  align = "left",
}: {
  children?: React.ReactNode;
  align?: "left" | "right";
}) {
  return (
    <th
      scope="col"
      className={cn(
        "border-b border-border bg-surface/40 px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted",
        align === "right" ? "text-right" : "text-left",
      )}
    >
      {children}
    </th>
  );
}

function Td({
  children,
  align = "left",
}: {
  children: React.ReactNode;
  align?: "left" | "right";
}) {
  return (
    <td
      className={cn(
        "border-b border-border/70 px-3 py-2 align-middle",
        align === "right" ? "text-right" : "text-left",
      )}
    >
      {children}
    </td>
  );
}
