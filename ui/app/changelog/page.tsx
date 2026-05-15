import type { Metadata } from "next";
import { TopNav } from "@/components/TopNav";
import { Footer } from "@/components/Footer";

export const metadata: Metadata = {
  title: "Changelog · Hunch",
  description:
    "Release notes for Hunch — the Polymarket crypto-vertical screener.",
};

type Entry = {
  version: string;
  date: string;
  tag: "shipped" | "beta" | "alpha";
  bullets: string[];
};

const ENTRIES: Entry[] = [
  {
    version: "v0.3",
    date: "2026-05-15",
    tag: "beta",
    bullets: [
      "Rebrand: polycrypto → Hunch. New wordmark, new metadata, new OG cards. Saved deposit-wallet addresses, watchlists, and L2 credentials carry over — the underlying localStorage keys are frozen on the old prefix on purpose.",
      "Framing pivot: Hunch leads with its own brand and surfaces the underlying venue (Polymarket) in the footer and onboarding flow rather than the hero. The product is a crypto-bet screener that happens to be Polymarket-backed, not a Polymarket frontend.",
      "Deposit-wallet dialog reworded as one-time onboarding — fewer protocol words, an explicit link to create a Polymarket account if the user doesn't have one yet.",
      "Hero, OG image, and root metadata reframed: 'crypto bets, sorted by signal' replaces 'Polymarket implied % vs. live state' as the headline.",
      "Custom-event namespace renamed from polycrypto:* to hunch:* across the screener, marquee, and order-ticket plumbing. Internal-only — no user-visible behaviour change.",
    ],
  },
  {
    version: "v0.2",
    date: "2026-05-13",
    tag: "beta",
    bullets: [
      "/portfolio page — live positions for the connected wallet, with mark value, unrealised P&L, and a 'redeem' badge for settled markets.",
      "/builder dashboard now shows market names (joined from local data) and PolygonScan links on each fill.",
      "/orders page now shows market names alongside the asset hash; order IDs are click-to-copy.",
      "ClobSession lifted into a React context — Polygon chain-switch prompt and L1 derivation now fire once per page mount, not once per consumer.",
      "Defensive fixes from end-to-end testing: BigInt(NaN) guard in the order ticket; throwOnError dropped from the bootstrap client so createOrDeriveApiKey can fall back to deriveApiKey for users who already have an API key; explicit wallet.switchChain(137) before signing; same-tab and cross-tab funder broadcast.",
      "Order attribution verified on-chain end-to-end via the JS SDK path.",
    ],
  },
  {
    version: "v0.1",
    date: "2026-05-09",
    tag: "beta",
    bullets: [
      "Public beta — read-only screener for ~5,000 active crypto-vertical Polymarket markets, sortable by Δ to trigger and Resolution Confidence.",
      "Click-to-expand rows reveal the resolution rule, 30-day implied-probability sparkline, and 1h / 24h / 7d / 30d deltas.",
      "Search, ticker filter, ★ starred filter, ⚡ live-only filter — all bookmarkable via URL state.",
      "Per-market detail pages at /markets/[slug] with shareable Open Graph cards.",
      "Trading ticket signs and posts orders through the underlying venue at 0% / 0% fees.",
      "Watchlists and open orders pages.",
      "Public read-only API at /api/markets.",
      "Snapshot auto-refresh every 60 s with bid/mid/ask quick-pick in the order ticket.",
      "Keyboard shortcuts (/, Esc, ?, g h, g w), focus trapping, prefers-reduced-motion respect.",
    ],
  },
];

const TAG_TONE: Record<Entry["tag"], string> = {
  shipped: "bg-emerald-500/15 text-emerald-200 ring-emerald-400/30",
  beta: "bg-accent/15 text-accent ring-accent/30",
  alpha: "bg-amber-500/15 text-amber-200 ring-amber-400/30",
};

export default function ChangelogPage() {
  return (
    <>
      <TopNav active="docs" />
      <main id="main" className="flex-1">
        <div className="mx-auto max-w-3xl px-4 py-10">
          <h1 className="text-3xl font-semibold tracking-tight">Changelog</h1>
          <p className="mt-2 text-sm text-muted">
            Release notes for Hunch. Newest first.
          </p>

          <ol className="mt-8 space-y-8">
            {ENTRIES.map((e) => (
              <li
                key={e.version}
                className="rounded-md border border-border bg-surface/40 p-5"
              >
                <div className="flex items-baseline gap-3">
                  <h2 className="text-xl font-semibold tabular tracking-tight">
                    {e.version}
                  </h2>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ring-1 ${TAG_TONE[e.tag]}`}
                  >
                    {e.tag}
                  </span>
                  <time
                    dateTime={e.date}
                    className="ml-auto tabular text-[12px] text-muted-2"
                  >
                    {e.date}
                  </time>
                </div>
                <ul className="mt-4 space-y-2 text-sm leading-relaxed text-foreground/85">
                  {e.bullets.map((b, i) => (
                    <li key={i} className="flex gap-2">
                      <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-accent" aria-hidden="true" />
                      <span>{b}</span>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ol>
        </div>
      </main>
      <Footer />
    </>
  );
}
