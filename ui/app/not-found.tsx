import { ChevronLeft } from "lucide-react";
import { TopNav } from "@/components/TopNav";
import { Footer } from "@/components/Footer";

export default function NotFound() {
  return (
    <>
      <TopNav />
      <main id="main" className="flex flex-1 items-center justify-center px-4 py-16">
        <div className="flex max-w-md flex-col items-center gap-4 text-center">
          <span className="rounded-full bg-rose-500/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-rose-300 ring-1 ring-rose-400/30">
            404
          </span>
          <h1 className="text-2xl font-semibold tracking-tight">
            Page not found
          </h1>
          <p className="text-sm text-muted">
            The market or page you’re looking for doesn’t exist or has been
            removed.
          </p>
          <a
            href="/"
            className="inline-flex items-center gap-1 rounded-md border border-border-strong bg-surface px-3 py-1.5 text-[13px] font-medium text-foreground hover:bg-surface-2"
          >
            <ChevronLeft className="h-3 w-3" />
            Back to screener
          </a>
        </div>
      </main>
      <Footer />
    </>
  );
}
