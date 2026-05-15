"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Loader2 } from "lucide-react";
import { CLOB_HOST } from "@/lib/polymarket";
import { cn } from "@/lib/cn";

type Range = "1d" | "7d" | "30d" | "all";

type Point = { t: number; p: number };

type RangeSpec = {
  label: string;
  /** Seconds before now. */
  lookbackSec: number;
  /** Fidelity (minutes between samples). */
  fidelity: number;
  /** Date-axis formatter. */
  fmtTick: (ms: number) => string;
};

const RANGES: Record<Range, RangeSpec> = {
  "1d": {
    label: "1D",
    lookbackSec: 86_400,
    fidelity: 5,
    fmtTick: (ms) =>
      new Date(ms).toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
        hour12: false,
      }),
  },
  "7d": {
    label: "7D",
    lookbackSec: 7 * 86_400,
    fidelity: 60,
    fmtTick: (ms) =>
      new Date(ms).toLocaleDateString("en-US", {
        weekday: "short",
      }),
  },
  "30d": {
    label: "30D",
    lookbackSec: 30 * 86_400,
    fidelity: 240,
    fmtTick: (ms) =>
      new Date(ms).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      }),
  },
  all: {
    label: "All",
    lookbackSec: 365 * 86_400,
    fidelity: 1440,
    fmtTick: (ms) =>
      new Date(ms).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      }),
  },
};

async function fetchHistory(
  tokenId: string,
  lookbackSec: number,
  fidelity: number,
): Promise<Point[]> {
  const now = Math.floor(Date.now() / 1000);
  const params = new URLSearchParams({
    market: tokenId,
    startTs: String(now - lookbackSec),
    endTs: String(now),
    fidelity: String(fidelity),
  });
  const r = await fetch(`${CLOB_HOST}/prices-history?${params}`, {
    cache: "no-store",
  });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const data = (await r.json()) as { history?: Point[] } | Point[];
  const raw = Array.isArray(data)
    ? data
    : Array.isArray(data?.history)
      ? (data.history as Point[])
      : [];
  // Normalise: server times are seconds in this endpoint. Convert to ms.
  return raw
    .filter((d) => d && isFinite(d.t) && isFinite(d.p))
    .map((d) => ({
      t: d.t > 1e12 ? d.t : d.t * 1000,
      p: Math.max(0, Math.min(1, d.p)),
    }));
}

type Props = {
  tokenId: string | null;
};

export function PriceHistoryChart({ tokenId }: Props) {
  const [range, setRange] = useState<Range>("30d");
  const [data, setData] = useState<Point[] | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!tokenId) return;
    let cancelled = false;
    setData(null);
    setErr(null);
    const spec = RANGES[range];
    fetchHistory(tokenId, spec.lookbackSec, spec.fidelity)
      .then((points) => {
        if (!cancelled) setData(points);
      })
      .catch((e) => {
        if (!cancelled) setErr((e as Error).message);
      });
    return () => {
      cancelled = true;
    };
  }, [tokenId, range]);

  const { first, last, deltaPp } = useMemo(() => {
    if (!data || data.length < 2) return { first: null, last: null, deltaPp: 0 };
    const f = data[0].p;
    const l = data[data.length - 1].p;
    return { first: f, last: l, deltaPp: (l - f) * 100 };
  }, [data]);

  const lineTone =
    deltaPp > 0 ? "stroke-emerald-300" : deltaPp < 0 ? "stroke-rose-300" : "stroke-zinc-300";
  const fillTone =
    deltaPp > 0 ? "fill-emerald-500/15" : deltaPp < 0 ? "fill-rose-500/15" : "fill-zinc-500/15";
  const strokeColor =
    deltaPp > 0 ? "#6ee7b7" : deltaPp < 0 ? "#fda4af" : "#a1a1aa";
  const fillColor =
    deltaPp > 0
      ? "rgba(52,211,153,0.15)"
      : deltaPp < 0
        ? "rgba(248,113,113,0.15)"
        : "rgba(161,161,170,0.15)";

  return (
    <section className="rounded-md border border-border bg-surface/40 p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="flex items-baseline gap-3 text-[10px] font-semibold uppercase tracking-wider text-muted-2">
          Implied probability
          {last != null ? (
            <span className="text-foreground normal-case font-normal text-[13px] tabular tracking-normal">
              {(last * 100).toFixed(1)}%
            </span>
          ) : null}
          {first != null && Math.abs(deltaPp) >= 0.05 ? (
            <span
              className={cn(
                "tabular normal-case font-medium text-[11px]",
                deltaPp > 0 ? "text-emerald-300" : "text-rose-300",
              )}
            >
              {deltaPp > 0 ? "+" : ""}
              {deltaPp.toFixed(1)} pp
            </span>
          ) : null}
        </h2>
        <RangeSelector value={range} onChange={setRange} />
      </div>

      <div className="relative h-56 w-full">
        {err ? (
          <p className="absolute inset-0 grid place-items-center text-[12px] text-rose-300">
            Couldn&apos;t load history: {err}
          </p>
        ) : !data ? (
          <div className="absolute inset-0 grid place-items-center text-[12px] text-muted">
            <span className="inline-flex items-center gap-2">
              <Loader2 className="h-3 w-3 animate-spin" />
              Loading {RANGES[range].label}…
            </span>
          </div>
        ) : data.length === 0 ? (
          <p className="absolute inset-0 grid place-items-center text-[12px] text-muted">
            No history for this range.
          </p>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={data}
              margin={{ top: 8, right: 8, bottom: 0, left: 0 }}
            >
              <defs>
                <linearGradient id="priceFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={strokeColor} stopOpacity={0.25} />
                  <stop offset="100%" stopColor={strokeColor} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis
                dataKey="t"
                type="number"
                scale="time"
                domain={["dataMin", "dataMax"]}
                tick={{ fill: "#8a91a3", fontSize: 10 }}
                stroke="rgba(255,255,255,0.1)"
                tickFormatter={(v) => RANGES[range].fmtTick(v as number)}
                minTickGap={40}
              />
              <YAxis
                domain={[0, 1]}
                ticks={[0, 0.25, 0.5, 0.75, 1]}
                tick={{ fill: "#8a91a3", fontSize: 10 }}
                stroke="rgba(255,255,255,0.1)"
                tickFormatter={(v) => `${Math.round((v as number) * 100)}%`}
                width={36}
              />
              <Tooltip
                contentStyle={{
                  background: "rgba(13,15,20,0.95)",
                  border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: 6,
                  fontSize: 12,
                  padding: "6px 10px",
                }}
                labelStyle={{ color: "#bdc2cf" }}
                labelFormatter={(v) =>
                  new Date(v as number).toLocaleString("en-US", {
                    month: "short",
                    day: "numeric",
                    hour: "numeric",
                    minute: "2-digit",
                  })
                }
                formatter={(v) => {
                  const n = typeof v === "number" ? v : parseFloat(String(v));
                  return [`${(n * 100).toFixed(1)}%`, "Implied YES"];
                }}
              />
              <Area
                type="monotone"
                dataKey="p"
                stroke={strokeColor}
                strokeWidth={1.5}
                fill="url(#priceFill)"
                fillOpacity={1}
                isAnimationActive={false}
                className={cn(lineTone, fillTone)}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </section>
  );
}

function RangeSelector({
  value,
  onChange,
}: {
  value: Range;
  onChange: (r: Range) => void;
}) {
  return (
    <div className="inline-flex rounded-md border border-border-strong bg-background p-0.5">
      {(Object.keys(RANGES) as Range[]).map((r) => (
        <button
          key={r}
          type="button"
          onClick={() => onChange(r)}
          aria-pressed={value === r}
          className={cn(
            "rounded px-2 py-0.5 text-[11px] font-semibold ring-1 ring-transparent",
            value === r
              ? "bg-accent/15 text-accent ring-accent/40"
              : "text-muted hover:text-foreground",
          )}
        >
          {RANGES[r].label}
        </button>
      ))}
    </div>
  );
}
