"use client";

import { AlertTriangle, ArrowUpRight } from "lucide-react";
import { useClobSession } from "@/lib/useClobSession";
import { useBalanceAllowance, fmtCollateral } from "@/lib/useBalanceAllowance";

export function ApprovalBanner() {
  const session = useClobSession();
  const allowance = useBalanceAllowance(session.client);

  // Hide unless we're connected enough to know whether allowances are missing.
  if (session.status !== "ready") return null;
  if (allowance.loading || allowance.error) return null;
  if (allowance.hasAnyAllowance) return null;

  return (
    <div className="border-b border-amber-400/30 bg-amber-500/10 text-amber-200">
      <div className="mx-auto flex max-w-[1480px] items-center gap-3 px-4 py-2 text-sm">
        <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
        <span className="font-medium">ACTION REQUIRED</span>
        <span className="text-amber-100/80">
          Re-approve your deposit wallet for trading. Balance{" "}
          <span className="tabular text-amber-50">
            {fmtCollateral(allowance.balance)}
          </span>{" "}
          pUSD, allowance set to 0.
        </span>
        <a
          href="https://polymarket.com/settings"
          target="_blank"
          rel="noopener noreferrer"
          className="ml-auto inline-flex items-center gap-1 rounded-md bg-amber-400/15 px-2 py-1 text-xs font-semibold text-amber-200 ring-1 ring-amber-400/40 hover:bg-amber-400/25"
        >
          Approve on Polymarket <ArrowUpRight className="h-3 w-3" />
        </a>
      </div>
    </div>
  );
}
