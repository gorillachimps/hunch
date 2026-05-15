import { NextResponse } from "next/server";
import { getSnapshotMeta } from "@/lib/data";

export const dynamic = "force-dynamic";

const STALE_AFTER_MS = 6 * 60 * 60 * 1000; // 6 hours

export async function GET() {
  const startedAt = Date.now();
  try {
    const snap = await getSnapshotMeta();
    const ageMs = startedAt - Date.parse(snap.snapshotAt);
    const fresh = ageMs < STALE_AFTER_MS;
    return NextResponse.json(
      {
        status: fresh ? "ok" : "stale",
        snapshotAt: snap.snapshotAt,
        snapshotAgeSeconds: Math.round(ageMs / 1000),
        markets: snap.total,
        elapsedMs: Date.now() - startedAt,
      },
      {
        status: fresh ? 200 : 503,
        headers: { "Cache-Control": "no-store" },
      },
    );
  } catch (e) {
    return NextResponse.json(
      {
        status: "error",
        error: (e as Error).message,
        elapsedMs: Date.now() - startedAt,
      },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}
