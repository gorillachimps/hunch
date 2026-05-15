import { NextRequest, NextResponse } from "next/server";

/**
 * Server-side lookup: given an EOA, find the Polymarket V2 DepositWallet
 * proxy (if any) that the EOA owns.
 *
 * How it works
 * ------------
 * Every Polymarket DepositWallet proxy (implementation
 * 0x58ca52ebe0dadfdf531cde7062e76746de4db1eb) emits the standard OZ
 * `OwnershipTransferred(address indexed previousOwner, address indexed
 * newOwner)` event when it's initialised. The previousOwner on initialise
 * is the zero address; the newOwner is the user's EOA.
 *
 * We query Polygonscan's eth_getLogs equivalent for any event matching:
 *   topic0 = keccak256("OwnershipTransferred(address,address)")
 *   topic1 = 0x000…0 (previousOwner)
 *   topic2 = padded EOA (newOwner)
 *
 * Each matching log's `address` field is the proxy contract itself. We pick
 * the most-recent one (highest block number) and return it.
 *
 * Why a server-side route (not a direct client fetch)
 * ---------------------------------------------------
 * Polygonscan requires an API key. Exposing it client-side as
 * NEXT_PUBLIC_POLYGONSCAN_API_KEY means anyone can scrape and abuse it.
 * This route uses a server-only POLYGONSCAN_API_KEY env var.
 *
 * Failure modes
 * -------------
 * - No API key configured → 503; client falls back to manual entry.
 * - Polygonscan returns no logs → 200 with `{proxy: null}`; same fallback.
 * - Polygonscan returns multiple proxies → pick the most recent (most
 *   common case: zero or one; in rare cases a user may have multiple).
 */

const FACTORY = "0xD3447596d282d62bc94240d17caee437efcfde62".toLowerCase();
// keccak256("OwnershipTransferred(address,address)")
const OWNERSHIP_TRANSFERRED_TOPIC =
  "0x8be0079c531659141344cd1fd0a4f28419497f9722a3daafe3b4186f6b6457e0";
const ZERO_TOPIC =
  "0x0000000000000000000000000000000000000000000000000000000000000000";

// Polymarket V2 launched in mid-2024 on Polygon; setting a generous lower
// bound keeps the query fast.
const FROM_BLOCK = "60000000";

export const dynamic = "force-dynamic";

type Log = {
  address: string;
  topics: string[];
  blockNumber: string;
};

export async function GET(req: NextRequest) {
  const apiKey = process.env.POLYGONSCAN_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "Auto-detect not configured on this deployment." },
      { status: 503 },
    );
  }

  const eoa = req.nextUrl.searchParams.get("eoa");
  if (!eoa || !/^0x[0-9a-fA-F]{40}$/.test(eoa)) {
    return NextResponse.json({ error: "Invalid EOA address." }, { status: 400 });
  }

  const eoaTopic = `0x${eoa.slice(2).toLowerCase().padStart(64, "0")}`;

  const url = new URL("https://api.polygonscan.com/api");
  url.searchParams.set("module", "logs");
  url.searchParams.set("action", "getLogs");
  url.searchParams.set("fromBlock", FROM_BLOCK);
  url.searchParams.set("toBlock", "latest");
  url.searchParams.set("topic0", OWNERSHIP_TRANSFERRED_TOPIC);
  url.searchParams.set("topic1", ZERO_TOPIC);
  url.searchParams.set("topic2", eoaTopic);
  url.searchParams.set("topic0_1_opr", "and");
  url.searchParams.set("topic1_2_opr", "and");
  url.searchParams.set("apikey", apiKey);

  try {
    const r = await fetch(url.toString(), { cache: "no-store" });
    if (!r.ok) {
      throw new Error(`Polygonscan HTTP ${r.status}`);
    }
    const body = (await r.json()) as {
      status: string;
      message?: string;
      result?: Log[] | string;
    };

    // Polygonscan returns status "0" for "no result" (with message "No
    // records found") AND for actual errors. Distinguish by inspecting
    // `result`: array on success, string on error.
    if (body.status !== "1") {
      if (Array.isArray(body.result)) {
        return NextResponse.json({ proxy: null });
      }
      // Treat "No records found" as a clean miss.
      if (body.message === "No records found") {
        return NextResponse.json({ proxy: null });
      }
      return NextResponse.json(
        { error: body.message ?? "Polygonscan error" },
        { status: 502 },
      );
    }

    const logs = (body.result ?? []) as Log[];
    if (!Array.isArray(logs) || logs.length === 0) {
      return NextResponse.json({ proxy: null });
    }

    // Sort by block number descending so we return the most recently-deployed
    // proxy if the EOA has more than one. Block numbers come back as hex strings.
    logs.sort(
      (a, b) =>
        parseInt(b.blockNumber, 16) - parseInt(a.blockNumber, 16),
    );

    const proxy = logs[0].address;
    if (!proxy || !/^0x[0-9a-fA-F]{40}$/.test(proxy)) {
      return NextResponse.json({ proxy: null });
    }

    // Stash the count so callers can decide whether to warn about multiple
    // matches (rare; usually 0 or 1).
    return NextResponse.json({
      proxy,
      count: logs.length,
      // Marker so the client knows which factory the proxy belongs to
      // (helps if we ever support multiple deposit-wallet versions).
      factory: FACTORY,
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
