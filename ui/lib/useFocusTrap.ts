"use client";

import { useEffect, type RefObject } from "react";

const FOCUSABLE = [
  "a[href]",
  "button:not([disabled])",
  "textarea:not([disabled])",
  'input:not([disabled]):not([type="hidden"])',
  "select:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

/** Trap keyboard focus inside `containerRef` while `enabled` is true and
 *  restore focus to whatever was focused beforehand on disable.
 *
 *  Optional `initialFocusSelector` — first matching element gets autofocus when
 *  the trap activates. Falls back to the first focusable element. */
export function useFocusTrap(
  enabled: boolean,
  containerRef: RefObject<HTMLElement | null>,
  initialFocusSelector?: string,
) {
  useEffect(() => {
    if (!enabled) return;
    const node = containerRef.current;
    if (!node) return;

    const previouslyFocused = document.activeElement as HTMLElement | null;

    const initial = initialFocusSelector
      ? node.querySelector<HTMLElement>(initialFocusSelector)
      : node.querySelector<HTMLElement>(FOCUSABLE);
    initial?.focus();

    function onKey(ev: KeyboardEvent) {
      if (ev.key !== "Tab") return;
      const focusables = Array.from(
        node!.querySelectorAll<HTMLElement>(FOCUSABLE),
      ).filter((el) => el.offsetParent !== null);
      if (focusables.length === 0) {
        ev.preventDefault();
        return;
      }
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement as HTMLElement | null;
      if (ev.shiftKey) {
        if (active === first || !node!.contains(active)) {
          ev.preventDefault();
          last.focus();
        }
      } else if (active === last) {
        ev.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      // Restore focus on unmount/disable, but only if the previously-focused
      // element is still in the DOM (otherwise let the browser pick).
      if (previouslyFocused && document.contains(previouslyFocused)) {
        previouslyFocused.focus();
      }
    };
  }, [enabled, containerRef, initialFocusSelector]);
}
