import { Suspense } from "react";
import { TopNav } from "@/components/TopNav";
import { ApprovalBanner } from "@/components/ApprovalBanner";
import { Footer } from "@/components/Footer";
import { HomeShell } from "@/components/HomeShell";
import { getMarkets, getSnapshotMeta } from "@/lib/data";

const MAX_ROWS = 500;

// Deadline-relative formatting in the table calls Date.now() at render time;
// keep SSR and client-hydration close together to avoid mismatches at the
// "<1h" / "ended" boundary.
export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [all, snapshot] = await Promise.all([getMarkets(), getSnapshotMeta()]);
  const ranked = [...all].sort((a, b) => b.volumeTotal - a.volumeTotal);
  const topRows = ranked.slice(0, MAX_ROWS);

  const liveCount = topRows.filter((r) => r.liveState === "live").length;
  const totalVolume24h = topRows.reduce((s, r) => s + (r.volume24h || 0), 0);

  return (
    <>
      <TopNav active="screener" />
      <ApprovalBanner />
      <Suspense fallback={null}>
        <HomeShell
          initialRows={topRows}
          initialSnapshotAt={snapshot.snapshotAt}
          liveCount={liveCount}
          totalVolume24h={totalVolume24h}
        />
      </Suspense>
      <Footer />
    </>
  );
}
