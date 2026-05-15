"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";

const SHORTCUTS: Array<{ keys: string[]; label: string }> = [
  { keys: ["/"], label: "Focus search" },
  { keys: ["Esc"], label: "Clear filters / blur input" },
  { keys: ["g", "h"], label: "Go to screener home" },
  { keys: ["g", "w"], label: "Go to watchlists" },
  { keys: ["?"], label: "Show / hide this help" },
];

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  if (target.isContentEditable) return true;
  return false;
}

type Props = {
  onClearFilters?: () => void;
  hasFilters?: boolean;
};

export function KeyboardShortcuts({ onClearFilters, hasFilters }: Props) {
  const [helpOpen, setHelpOpen] = useState(false);
  const [chord, setChord] = useState<string | null>(null);

  useEffect(() => {
    let chordTimeout: ReturnType<typeof setTimeout> | null = null;

    const onKey = (ev: KeyboardEvent) => {
      // Modifier-bearing presses are likely browser shortcuts; let them through.
      if (ev.metaKey || ev.ctrlKey || ev.altKey) return;

      const key = ev.key;
      const typing = isTypingTarget(ev.target);

      // Esc: blur input first; if nothing focused (or already idle) and we have
      // active filters, clear them.
      if (key === "Escape") {
        if (typing) {
          (ev.target as HTMLElement).blur();
          ev.preventDefault();
          return;
        }
        if (helpOpen) {
          setHelpOpen(false);
          ev.preventDefault();
          return;
        }
        if (hasFilters && onClearFilters) {
          onClearFilters();
          ev.preventDefault();
        }
        return;
      }

      if (typing) return;

      if (key === "/") {
        const input =
          document.querySelector<HTMLInputElement>('input[type="search"]');
        if (input) {
          input.focus();
          input.select();
          ev.preventDefault();
        }
        return;
      }

      if (key === "?") {
        setHelpOpen((v) => !v);
        ev.preventDefault();
        return;
      }

      if (key === "g") {
        setChord("g");
        if (chordTimeout) clearTimeout(chordTimeout);
        chordTimeout = setTimeout(() => setChord(null), 800);
        ev.preventDefault();
        return;
      }

      if (chord === "g") {
        if (key === "h") {
          window.location.href = "/";
          ev.preventDefault();
        } else if (key === "w") {
          window.location.href = "/watchlists";
          ev.preventDefault();
        }
        setChord(null);
        if (chordTimeout) clearTimeout(chordTimeout);
        return;
      }
    };

    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      if (chordTimeout) clearTimeout(chordTimeout);
    };
  }, [chord, helpOpen, hasFilters, onClearFilters]);

  return (
    <>
      {chord ? (
        <div className="fixed bottom-4 left-4 z-50 rounded-md border border-border-strong bg-surface px-3 py-1.5 text-[12px] tabular text-foreground shadow-lg">
          <kbd className="font-mono">{chord}</kbd>
          <span className="ml-1 text-muted-2">…</span>
        </div>
      ) : null}

      {helpOpen ? (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 grid place-items-center bg-black/60 px-4"
          onClick={() => setHelpOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm rounded-lg border border-border-strong bg-surface p-4 shadow-2xl"
          >
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold tracking-tight">
                Keyboard shortcuts
              </h2>
              <button
                type="button"
                aria-label="Close"
                onClick={() => setHelpOpen(false)}
                className="grid h-6 w-6 place-items-center rounded text-muted hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <ul className="space-y-1.5 text-[12px]">
              {SHORTCUTS.map((s) => (
                <li key={s.keys.join("+")} className="flex items-center justify-between">
                  <span className="text-foreground/80">{s.label}</span>
                  <span className="flex items-center gap-1">
                    {s.keys.map((k, i) => (
                      <kbd
                        key={i}
                        className="rounded border border-border-strong bg-background px-1.5 py-0.5 font-mono text-[11px] text-foreground"
                      >
                        {k}
                      </kbd>
                    ))}
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-[10px] text-muted-2">
              Press{" "}
              <kbd className="rounded border border-border-strong bg-background px-1 font-mono">
                Esc
              </kbd>{" "}
              to close.
            </p>
          </div>
        </div>
      ) : null}
    </>
  );
}
