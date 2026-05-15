"use client";

// Lightweight event-tracking shim. Forwards custom events to Plausible when
// it's loaded; no-op otherwise. Safe to call from any client component without
// guarding for analytics presence.
//
// Usage:
//   import { track } from "@/lib/track";
//   track("order_placed", { outcome: "yes", market: market.slug });

type Props = Record<string, string | number | boolean | undefined | null>;

type Plausible = (
  event: string,
  options?: { props?: Props; callback?: () => void },
) => void;

declare global {
  interface Window {
    plausible?: Plausible;
  }
}

export function track(event: string, props?: Props): void {
  if (typeof window === "undefined") return;
  const p = window.plausible;
  if (!p) return;
  try {
    // Strip nullish props — Plausible rejects null values.
    const clean: Record<string, string | number | boolean> | undefined = props
      ? Object.fromEntries(
          Object.entries(props).filter(([, v]) => v != null),
        ) as Record<string, string | number | boolean>
      : undefined;
    p(event, clean ? { props: clean } : undefined);
  } catch {
    // Analytics is best-effort.
  }
}
