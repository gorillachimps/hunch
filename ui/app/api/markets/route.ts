import { NextResponse } from "next/server";
import { getMarkets } from "@/lib/data";

export const revalidate = 60;

export async function GET(request: Request) {
  const url = new URL(request.url);
  const family = url.searchParams.get("family");
  const limit = Math.min(
    Number(url.searchParams.get("limit") ?? "500") || 500,
    5000,
  );

  const all = await getMarkets();
  const ranked = [...all].sort((a, b) => b.volumeTotal - a.volumeTotal);
  const filtered = family ? ranked.filter((r) => r.family === family) : ranked;
  const slice = filtered.slice(0, limit);

  return NextResponse.json(
    {
      generatedAt: new Date().toISOString(),
      total: filtered.length,
      returned: slice.length,
      markets: slice,
    },
    { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" } },
  );
}
