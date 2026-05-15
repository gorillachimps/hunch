"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";

type Props = { snapshotAt: string };

function relative(iso: string, now: number): string {
  const t = Date.parse(iso);
  if (!isFinite(t)) return iso;
  const ms = now - t;
  // Clock skew between server (which stamped `iso`) and client can flip the
  // sign by a few seconds. Clamp anything within a small margin to "just now".
  if (ms < 5_000) return "just now";
  const sec = Math.round(ms / 1000);
  if (sec < 60) return `${sec}s ago`;
  const min = Math.round(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hrs = Math.round(min / 60);
  if (hrs < 48) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  return `${days}d ago`;
}

export function SnapshotMeta({ snapshotAt }: Props) {
  // Avoid hydration mismatch from `Date.now()` and locale: anchor the SSR pass at
  // the snapshot time itself ("just now"), then update on the client after mount.
  const [now, setNow] = useState<number>(() => Date.parse(snapshotAt));
  const [flash, setFlash] = useState(false);
  const lastSnapRef = useRef(snapshotAt);

  useEffect(() => {
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  // Briefly highlight the pill whenever a fresh snapshot arrives — gives the
  // auto-refresh a moment of visual feedback without being shouty.
  useEffect(() => {
    if (lastSnapRef.current === snapshotAt) return;
    lastSnapRef.current = snapshotAt;
    setFlash(true);
    const t = setTimeout(() => setFlash(false), 1100);
    return () => clearTimeout(t);
  }, [snapshotAt]);

  return (
    <span
      title={snapshotAt}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] ring-1 transition-colors duration-700",
        flash
          ? "bg-accent/20 text-accent ring-accent/40"
          : "bg-zinc-800/60 text-muted ring-border",
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "h-1.5 w-1.5 rounded-full transition-colors duration-700",
          flash ? "bg-accent motion-safe:animate-pulse" : "bg-sky-400",
        )}
      />
      Snapshot {relative(snapshotAt, now)}
    </span>
  );
}
