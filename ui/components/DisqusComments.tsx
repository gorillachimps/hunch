"use client";

import { useEffect } from "react";

const SHORTNAME = process.env.NEXT_PUBLIC_DISQUS_SHORTNAME;

type Props = {
  /** Stable per-thread identifier. Use the market slug. */
  identifier: string;
  /** Page title shown in Disqus moderation. */
  title: string;
  /** Canonical URL of the thread. */
  url: string;
};

/**
 * Disqus comments thread, scoped per market by `identifier` (the market slug).
 * Renders nothing if `NEXT_PUBLIC_DISQUS_SHORTNAME` isn't set, so the feature
 * stays invisible until the operator registers a free Disqus shortname and
 * fills in the env var on Vercel.
 *
 * Implementation note: Disqus's embed script is global. When navigating
 * between markets we reset it via `DISQUS.reset` instead of re-injecting,
 * which would create a second instance.
 */
export function DisqusComments({ identifier, title, url }: Props) {
  useEffect(() => {
    if (!SHORTNAME) return;

    // Set page-level config; Disqus reads this on initial load + reset.
    (window as unknown as DisqusWindow).disqus_config = function (this: DisqusPageConfig) {
      this.page.url = url;
      this.page.identifier = identifier;
      this.page.title = title;
    };

    // Either inject the script (first mount) or call DISQUS.reset (revisits).
    const w = window as unknown as DisqusWindow;
    if (w.DISQUS && typeof w.DISQUS.reset === "function") {
      w.DISQUS.reset({
        reload: true,
        config: function (this: DisqusPageConfig) {
          this.page.url = url;
          this.page.identifier = identifier;
          this.page.title = title;
        },
      });
    } else if (!document.getElementById("dsq-embed-scr")) {
      const s = document.createElement("script");
      s.id = "dsq-embed-scr";
      s.src = `https://${SHORTNAME}.disqus.com/embed.js`;
      s.setAttribute("data-timestamp", String(Date.now()));
      s.async = true;
      document.head.appendChild(s);
    }
  }, [identifier, title, url]);

  if (!SHORTNAME) return null;

  return (
    <section className="rounded-md border border-border bg-surface/40 p-4">
      <h2 className="mb-3 flex items-center justify-between gap-2 text-[10px] font-semibold uppercase tracking-wider text-muted-2">
        <span>Discussion</span>
        <span className="text-[10px] font-normal normal-case text-muted-2/70">
          powered by Disqus
        </span>
      </h2>
      <div id="disqus_thread" />
      <noscript>
        Please enable JavaScript to view the{" "}
        <a
          href="https://disqus.com/?ref_noscript"
          target="_blank"
          rel="noopener noreferrer"
          className="text-accent hover:underline"
        >
          comments powered by Disqus
        </a>
        .
      </noscript>
    </section>
  );
}

// Minimal type surface for the Disqus global. We don't pull in @types/disqus
// to keep dev deps tight; this covers the two calls we make.
type DisqusPageConfig = {
  page: { url: string; identifier: string; title: string };
};
type DisqusGlobal = {
  reset: (args: {
    reload?: boolean;
    config: (this: DisqusPageConfig) => void;
  }) => void;
};
type DisqusWindow = Window & {
  disqus_config?: (this: DisqusPageConfig) => void;
  DISQUS?: DisqusGlobal;
};
