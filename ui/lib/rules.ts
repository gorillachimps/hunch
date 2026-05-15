import type { TableRow } from "./types";

const dateFmt = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

function fmtDate(iso: string | null) {
  if (!iso) return "no deadline";
  const t = Date.parse(iso);
  if (!isFinite(t)) return iso;
  return dateFmt.format(new Date(t));
}

function fmtThreshold(value: number | null, currency: string | null) {
  if (value == null) return "—";
  const cur = currency ?? "USD";
  if (cur === "USD") {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: value < 1 ? 4 : 0,
    }).format(value);
  }
  return `${value.toLocaleString()} ${cur}`;
}

/** One-liner human summary of the resolution rule. Best-effort per family. */
export function summarizeRules(r: TableRow): string {
  const deadline = fmtDate(r.endDate);
  switch (r.family) {
    case "binance_price": {
      const pair = r.pair ?? r.symbol ?? "the pair";
      const op = r.thresholdOp ?? ">=";
      const target = fmtThreshold(r.thresholdValue, r.currency);
      return `Resolves YES if Binance ${pair} prints ${op} ${target} at any point before ${deadline}.`;
    }
    case "fdv_after_launch": {
      const asset = r.asset ?? r.symbol ?? "the token";
      const target = fmtThreshold(r.thresholdValue, r.currency);
      return `Resolves YES if ${asset} reaches ${target} fully-diluted valuation after launch and before ${deadline}.`;
    }
    case "public_sale": {
      const asset = r.asset ?? r.symbol ?? "the token";
      const target = fmtThreshold(r.thresholdValue, r.currency);
      return `Resolves YES if a public sale of ${asset} clears ${target} on or before ${deadline}.`;
    }
    case "holdings_event": {
      const entity = r.entity ?? "the entity";
      const action = r.action ?? "performs the action";
      const asset = r.asset ?? "the asset";
      return `Resolves YES if on-chain evidence confirms ${entity} ${action} ${asset} on or before ${deadline}.`;
    }
    case "subjective":
      return `Subjective: Polymarket's UMA-arbitrated panel resolves this market on or before ${deadline}. No machine-readable trigger.`;
    case "unmatched":
    default:
      return `Resolution rule not yet structured. Deadline ${deadline}.`;
  }
}
