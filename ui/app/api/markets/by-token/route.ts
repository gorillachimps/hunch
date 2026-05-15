import { NextResponse } from "next/server";
import { getMarketsByTokens } from "@/lib/data";

export const dynamic = "force-dynamic";

// Cap how many tokens a single request may ask about so an attacker can't
// trigger an expensive O(rows × tokens) lookup with thousands of IDs.
const MAX_TOKENS = 500;

function clean(ids: string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of ids) {
    const id = raw.trim();
    if (!id) continue;
    // Asset IDs are stringified uint256 — digits only, reasonable length.
    if (!/^[0-9]+$/.test(id)) continue;
    if (id.length > 80) continue;
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(id);
    if (out.length >= MAX_TOKENS) break;
  }
  return out;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const raw = url.searchParams.get("ids") ?? "";
  const ids = clean(raw.split(","));
  if (ids.length === 0) {
    return NextResponse.json(
      { error: "expected ?ids=<comma-separated uint256 token ids>" },
      { status: 400 },
    );
  }
  const lookup = await getMarketsByTokens(ids);
  return NextResponse.json(
    { count: Object.keys(lookup).length, lookup },
    {
      headers: {
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
      },
    },
  );
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }
  if (!body || typeof body !== "object") {
    return NextResponse.json(
      { error: "expected { tokens: [...] }" },
      { status: 400 },
    );
  }
  const rawTokens = (body as { tokens?: unknown }).tokens;
  if (!Array.isArray(rawTokens)) {
    return NextResponse.json(
      { error: "expected { tokens: [...] }" },
      { status: 400 },
    );
  }
  const ids = clean(rawTokens.map(String));
  const lookup = await getMarketsByTokens(ids);
  return NextResponse.json({ count: Object.keys(lookup).length, lookup });
}
