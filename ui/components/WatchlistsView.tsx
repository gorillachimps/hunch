"use client";

import { useState, useMemo } from "react";
import type { SortingState } from "@tanstack/react-table";
import { Star } from "lucide-react";
import { MarketTable } from "./MarketTable";
import { useStarred } from "@/lib/useStarred";
import type { TableRow } from "@/lib/types";

type Props = { rows: TableRow[] };

export function WatchlistsView({ rows }: Props) {
  const { starred } = useStarred();
  const [sorting, setSorting] = useState<SortingState>([
    { id: "volume24h", desc: true },
  ]);

  const watch = useMemo(
    () => rows.filter((r) => starred.has(r.id)),
    [rows, starred],
  );

  if (starred.size === 0) {
    return (
      <div className="mt-8 rounded-md border border-border bg-surface/40 px-6 py-12 text-center">
        <div className="mx-auto grid h-10 w-10 place-items-center rounded-full bg-amber-500/15 ring-1 ring-amber-400/30">
          <Star className="h-5 w-5 text-amber-300" />
        </div>
        <h2 className="mt-4 text-base font-semibold">No starred markets yet</h2>
        <p className="mx-auto mt-1 max-w-md text-sm text-muted">
          Click the{" "}
          <Star className="inline h-3 w-3 align-text-top text-muted-2" /> on any
          market in the screener to pin it here. Watchlists live in your browser
          — there&apos;s no account required.
        </p>
        <a
          href="/"
          className="mt-4 inline-block rounded-md border border-border-strong bg-surface px-3 py-1.5 text-[13px] font-medium text-foreground hover:bg-surface-2"
        >
          Browse the screener
        </a>
      </div>
    );
  }

  if (watch.length === 0) {
    return (
      <div className="mt-8 rounded-md border border-border bg-surface/40 px-6 py-12 text-center">
        <p className="text-sm text-muted">
          You have {starred.size.toLocaleString()} starred markets, but none of
          them are in the current top-500 server snapshot.
        </p>
      </div>
    );
  }

  return (
    <MarketTable
      rows={watch}
      sorting={sorting}
      onSortingChange={setSorting}
    />
  );
}
