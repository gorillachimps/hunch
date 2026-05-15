"use client";

import { useEffect, useMemo, useState } from "react";
import { polymarketMarketWs, type WsStatus } from "./polymarketWs";

/**
 * Public React hooks over the Polymarket market-data WS singleton.
 *
 * Pricing convention reminders (matches the HTTP /book endpoint):
 *   - bids are sorted ASCENDING by price → best bid is at array[length - 1]
 *   - asks are sorted DESCENDING by price → best ask is at array[length - 1]
 *
 * Hooks here normalise event payloads, sort levels per the above, and expose
 * stable React state. Internally each hook owns its own copy of book state per
 * tokenId — the singleton WS only dispatches events to subscribers, it doesn't
 * cache books.
 */

export type Level = { price: string; size: string };

export type LiveBook = {
  bids: Level[];
  asks: Level[];
  /** Server-supplied timestamp string, opaque format. */
  timestamp?: string;
  /** Monotonically increasing version, useful for memo deps. */
  version: number;
};

export type LiveLastTrade = {
  price: number;
  size: number;
  side: "BUY" | "SELL";
  /** Unix milliseconds. */
  timestamp: number;
};

type RawChange = { price: string; side: "BUY" | "SELL"; size: string };

function sortBids(levels: Map<string, string>): Level[] {
  return [...levels.entries()]
    .map(([price, size]) => ({ price, size }))
    .sort((a, b) => parseFloat(a.price) - parseFloat(b.price));
}

function sortAsks(levels: Map<string, string>): Level[] {
  return [...levels.entries()]
    .map(([price, size]) => ({ price, size }))
    .sort((a, b) => parseFloat(b.price) - parseFloat(a.price));
}

function applyPriceChanges(book: LiveBook, changes: RawChange[]): LiveBook {
  const bids = new Map<string, string>();
  const asks = new Map<string, string>();
  for (const lvl of book.bids) bids.set(lvl.price, lvl.size);
  for (const lvl of book.asks) asks.set(lvl.price, lvl.size);
  for (const c of changes ?? []) {
    const target = c.side === "BUY" ? bids : asks;
    const n = parseFloat(c.size);
    if (!isFinite(n) || n <= 0) target.delete(c.price);
    else target.set(c.price, c.size);
  }
  return {
    bids: sortBids(bids),
    asks: sortAsks(asks),
    timestamp: book.timestamp,
    version: book.version + 1,
  };
}

function topBid(book: LiveBook | null): number | null {
  if (!book || book.bids.length === 0) return null;
  const v = parseFloat(book.bids[book.bids.length - 1].price);
  return isFinite(v) ? v : null;
}

function topAsk(book: LiveBook | null): number | null {
  if (!book || book.asks.length === 0) return null;
  const v = parseFloat(book.asks[book.asks.length - 1].price);
  return isFinite(v) ? v : null;
}

function midFromBook(book: LiveBook | null): number | null {
  const b = topBid(book);
  const a = topAsk(book);
  if (b != null && a != null) return (b + a) / 2;
  if (b != null) return b;
  if (a != null) return a;
  return null;
}

/** Live, mutable order book for a single token. Null while loading. */
export function useLiveBook(tokenId: string | null | undefined): LiveBook | null {
  const [book, setBook] = useState<LiveBook | null>(null);
  useEffect(() => {
    if (!tokenId) {
      setBook(null);
      return;
    }
    setBook(null); // reset when tokenId changes
    const unsub = polymarketMarketWs.subscribe([tokenId], {
      onBook: (e) => {
        const bids = (e.bids as Level[] | undefined) ?? [];
        const asks = (e.asks as Level[] | undefined) ?? [];
        // Re-sort defensively — the snapshot from /book is already sorted but
        // a stale or partial snapshot could trip the rest of the pipeline.
        const bidMap = new Map<string, string>();
        const askMap = new Map<string, string>();
        for (const l of bids) if (l?.price) bidMap.set(l.price, l.size);
        for (const l of asks) if (l?.price) askMap.set(l.price, l.size);
        setBook({
          bids: sortBids(bidMap),
          asks: sortAsks(askMap),
          timestamp: e.timestamp as string | undefined,
          version: 0,
        });
      },
      onPriceChange: (e) => {
        const changes = (e.changes as RawChange[] | undefined) ?? [];
        setBook((prev) => (prev ? applyPriceChanges(prev, changes) : prev));
      },
    });
    return unsub;
  }, [tokenId]);
  return book;
}

/** Just the live mid (bid+ask)/2 for a token. */
export function useLiveMid(tokenId: string | null | undefined): number | null {
  const book = useLiveBook(tokenId);
  return useMemo(() => midFromBook(book), [book?.version, book]);
}

/** Most recent matched trade for a token. */
export function useLastTrade(
  tokenId: string | null | undefined,
): LiveLastTrade | null {
  const [lt, setLt] = useState<LiveLastTrade | null>(null);
  useEffect(() => {
    if (!tokenId) {
      setLt(null);
      return;
    }
    const unsub = polymarketMarketWs.subscribe([tokenId], {
      onLastTrade: (e) => {
        const price = parseFloat(e.price as string);
        const size = parseFloat(e.size as string);
        const tsRaw = e.timestamp as string | undefined;
        const tsNum = tsRaw ? parseFloat(tsRaw) : NaN;
        // Polymarket sends ms in some channels, seconds in others. Normalise.
        const ts = isFinite(tsNum)
          ? tsNum > 1e12
            ? tsNum
            : tsNum * 1000
          : Date.now();
        if (isFinite(price)) {
          setLt({
            price,
            size: isFinite(size) ? size : 0,
            side: (e.side as "BUY" | "SELL") ?? "BUY",
            timestamp: ts,
          });
        }
      },
    });
    return unsub;
  }, [tokenId]);
  return lt;
}

/**
 * Batch hook for the screener: subscribe to many tokens, get a Map of live
 * mids. Books are tracked internally per token; the returned Map identity
 * changes when ANY mid changes, so consumers should `useMemo` for derived
 * arrays of rows.
 */
export function useLiveMidMap(tokenIds: string[]): Map<string, number> {
  const depKey = useMemo(
    () => [...new Set(tokenIds)].filter((x) => !!x).sort().join(","),
    [tokenIds],
  );
  const [mids, setMids] = useState<Map<string, number>>(() => new Map());

  useEffect(() => {
    const ids = depKey ? depKey.split(",") : [];
    if (ids.length === 0) {
      setMids(new Map());
      return;
    }
    // Per-token book state lives in this closure, NOT in component state, so
    // we don't trigger a re-render on every price_change event — only when a
    // mid actually changes.
    const localBooks = new Map<string, { bids: Map<string, string>; asks: Map<string, string> }>();

    function recomputeMid(id: string) {
      const b = localBooks.get(id);
      if (!b) return;
      // Best bid = highest price in bids; best ask = lowest in asks.
      let bestBid: number | null = null;
      for (const p of b.bids.keys()) {
        const n = parseFloat(p);
        if (isFinite(n) && (bestBid == null || n > bestBid)) bestBid = n;
      }
      let bestAsk: number | null = null;
      for (const p of b.asks.keys()) {
        const n = parseFloat(p);
        if (isFinite(n) && (bestAsk == null || n < bestAsk)) bestAsk = n;
      }
      const mid =
        bestBid != null && bestAsk != null
          ? (bestBid + bestAsk) / 2
          : bestBid ?? bestAsk;
      if (mid == null) return;
      setMids((prev) => {
        const cur = prev.get(id);
        if (cur != null && Math.abs(cur - mid) < 1e-9) return prev;
        const next = new Map(prev);
        next.set(id, mid);
        return next;
      });
    }

    const unsub = polymarketMarketWs.subscribe(ids, {
      onBook: (e) => {
        const id = e.asset_id as string;
        const bids = new Map<string, string>();
        const asks = new Map<string, string>();
        for (const lvl of ((e.bids as Level[] | undefined) ?? [])) {
          if (lvl?.price) bids.set(lvl.price, lvl.size);
        }
        for (const lvl of ((e.asks as Level[] | undefined) ?? [])) {
          if (lvl?.price) asks.set(lvl.price, lvl.size);
        }
        localBooks.set(id, { bids, asks });
        recomputeMid(id);
      },
      onPriceChange: (e) => {
        const id = e.asset_id as string;
        const b = localBooks.get(id);
        if (!b) return;
        for (const c of ((e.changes as RawChange[] | undefined) ?? [])) {
          const target = c.side === "BUY" ? b.bids : b.asks;
          const n = parseFloat(c.size);
          if (!isFinite(n) || n <= 0) target.delete(c.price);
          else target.set(c.price, c.size);
        }
        recomputeMid(id);
      },
    });
    return unsub;
  }, [depKey]);

  return mids;
}

/** WS connection status. Useful for showing a "Live"/"Reconnecting" pip. */
export function useWsStatus(): WsStatus {
  const [status, setStatus] = useState<WsStatus>("idle");
  useEffect(() => polymarketMarketWs.onStatus(setStatus), []);
  return status;
}
