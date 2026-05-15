import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ChevronLeft, ExternalLink } from "lucide-react";
import { TopNav } from "@/components/TopNav";
import { Footer } from "@/components/Footer";
import { DeltaBar } from "@/components/DeltaBar";
import { RcBar } from "@/components/RcBar";
import { Sparkline } from "@/components/Sparkline";
import { PositionCard } from "@/components/PositionCard";
import { OrderBookView } from "@/components/OrderBookView";
import { LivePmImpliedStat } from "@/components/LivePmImpliedStat";
import { cn } from "@/lib/cn";
import { getMarketBySlug } from "@/lib/data";
import {
  fmtCompactUSD,
  fmtDaysLeft,
  fmtImpliedPct,
  fmtSignedPP,
  fmtSourceLabel,
  fmtUSD,
} from "@/lib/format";
import { familyMeta, FAMILY_TONE_CLASSES } from "@/lib/families";
import { summarizeRules } from "@/lib/rules";
import type { TableRow } from "@/lib/types";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const row = await getMarketBySlug(slug);
  if (!row) return { title: "Market not found · Hunch" };
  return {
    title: `${row.question} · Hunch`,
    description: summarizeRules(row),
  };
}

function clamp01(n: number) {
  if (!isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

function buildHistory(r: TableRow): number[] {
  const now = clamp01(r.impliedYes ?? 0.5);
  const minus1h = clamp01(now - (r.oneHourChange ?? 0));
  const minus24h = clamp01(now - (r.oneDayChange ?? 0));
  const minus7d = clamp01(now - (r.oneWeekChange ?? r.oneDayChange ?? 0));
  const minus30d = clamp01(
    now - (r.oneMonthChange ?? r.oneWeekChange ?? r.oneDayChange ?? 0),
  );
  return [minus30d, minus7d, minus24h, minus1h, now];
}

export default async function MarketDetailPage({ params }: Props) {
  const { slug } = await params;
  const row = await getMarketBySlug(slug);
  if (!row) notFound();

  const meta = familyMeta(row.family);
  const tone = FAMILY_TONE_CLASSES[meta.tone];
  const history = buildHistory(row);
  const overall = history[history.length - 1] - history[0];
  const trendColor =
    overall > 0.001
      ? "text-emerald-300"
      : overall < -0.001
        ? "text-rose-300"
        : "text-muted-2";

  return (
    <>
      <TopNav />
      <main id="main" className="flex-1">
        <div className="mx-auto max-w-[1100px] px-4 py-6">
          <a
            href="/"
            className="inline-flex items-center gap-1 text-[12px] text-muted hover:text-foreground"
          >
            <ChevronLeft className="h-3 w-3" />
            Back to screener
          </a>

          <div className="mt-3 flex flex-wrap items-start gap-3">
            <span
              className={cn(
                "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ring-1",
                tone,
              )}
            >
              {meta.label}
            </span>
            <span className="text-[12px] text-muted">
              {fmtSourceLabel(row.source, row.pair)}
            </span>
          </div>
          <h1 className="mt-2 text-2xl font-semibold leading-tight tracking-tight">
            {row.question}
          </h1>

          <div className="mt-6 grid gap-3 sm:grid-cols-4">
            <LivePmImpliedStat
              tokenYes={row.tokenYes ?? null}
              bestBid={row.bestBid ?? null}
              bestAsk={row.bestAsk ?? null}
              fallbackImpliedYes={row.impliedYes}
            />
            <BigStat
              label="Current state"
              value={
                row.liveState === "live" && row.currentValue != null
                  ? fmtUSD(row.currentValue)
                  : "—"
              }
              hint={row.liveState === "deferred" ? "deferred" : undefined}
            />
            <BigStat
              label="Volume"
              value={fmtCompactUSD(row.volumeTotal)}
              hint={`24h ${fmtCompactUSD(row.volume24h)}`}
            />
            <BigStat
              label="Closes in"
              value={fmtDaysLeft(row.endDate)}
              hint={
                row.endDate ? new Date(row.endDate).toUTCString() : undefined
              }
            />
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <Card title="Δ to trigger">
              <DeltaBar
                distance={row.distancePct}
                alreadyTriggered={row.alreadyTriggered}
                deferred={row.liveState !== "live"}
              />
              {row.liveState === "live" && row.distancePct != null ? (
                <p className="mt-2 text-[12px] text-muted">
                  Threshold {row.thresholdValue != null ? fmtUSD(row.thresholdValue) : "—"} ·
                  {" "}
                  current {fmtUSD(row.currentValue)} ·
                  {" "}
                  {(row.distancePct * 100).toFixed(2)}% away
                </p>
              ) : (
                <p className="mt-2 text-[12px] text-muted">
                  No live machine-readable trigger for this market.
                </p>
              )}
            </Card>
            <Card title="Resolution Confidence (RC)">
              <RcBar rc={row.rc} />
              <p className="mt-2 text-[12px] text-muted">
                Composite of distance ({"55%"}), time pressure ({"30%"}) and log-volume ({"15%"}). Higher
                means a more legible resolution path.
              </p>
            </Card>
          </div>

          <div className="mt-6">
            <PositionCard market={row} />
          </div>

          <div className="mt-6">
            <OrderBookView
              tokenYes={row.tokenYes ?? null}
              tokenNo={row.tokenNo ?? null}
            />
          </div>

          <Card className="mt-6" title="Rule">
            <p className="text-[13px] leading-relaxed text-foreground/90">
              {summarizeRules(row)}
              {row.liveState === "deferred" && row.liveReason ? (
                <span className="ml-2 text-muted">({row.liveReason})</span>
              ) : null}
            </p>
          </Card>

          <Card className="mt-6" title="Implied probability, last 30d">
            <div className="flex items-center gap-4">
              <span className={trendColor}>
                <Sparkline values={history} width={420} height={64} />
              </span>
              <div className="flex flex-1 flex-wrap gap-x-6 gap-y-2 text-[12px]">
                <ChangeStat label="1h" value={row.oneHourChange} />
                <ChangeStat label="24h" value={row.oneDayChange} />
                <ChangeStat label="7d" value={row.oneWeekChange} />
                <ChangeStat label="30d" value={row.oneMonthChange} />
              </div>
            </div>
            <p className="mt-2 text-[11px] text-muted-2">
              Reconstructed from cumulative change windows; not a tick-by-tick history.
            </p>
          </Card>

          <div className="mt-6 flex flex-wrap items-center gap-3 text-[12px] text-muted">
            <a
              href={`https://polymarket.com/event/${row.slug}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 rounded border border-border-strong bg-surface px-3 py-1.5 text-foreground hover:bg-surface-2"
            >
              Open on Polymarket <ExternalLink className="h-3 w-3" />
            </a>
            <span className="font-mono text-muted-2">id {row.id}</span>
            <span className="font-mono text-muted-2">slug {row.slug}</span>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}

function BigStat({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-md border border-border bg-surface/40 px-3 py-2">
      <div className="text-[10px] uppercase tracking-wider text-muted-2">
        {label}
      </div>
      <div className="tabular text-lg font-semibold">{value}</div>
      {hint ? (
        <div className="tabular text-[11px] text-muted">{hint}</div>
      ) : null}
    </div>
  );
}

function Card({
  title,
  children,
  className,
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "rounded-md border border-border bg-surface/40 p-4",
        className,
      )}
    >
      <h2 className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-muted-2">
        {title}
      </h2>
      {children}
    </section>
  );
}

function ChangeStat({
  label,
  value,
}: {
  label: string;
  value: number | null;
}) {
  const v = fmtSignedPP(value);
  return (
    <div className="flex flex-col">
      <span className="text-[10px] uppercase tracking-wider text-muted-2">
        Δ {label}
      </span>
      <span className="tabular font-medium">
        {v == null ? (
          <span className="text-muted-2">—</span>
        ) : v.sign === 0 ? (
          <span className="text-muted">0pp</span>
        ) : (
          <span className={v.sign > 0 ? "text-emerald-300" : "text-rose-300"}>
            {v.sign > 0 ? "▲" : "▼"} {v.text}
          </span>
        )}
      </span>
    </div>
  );
}
