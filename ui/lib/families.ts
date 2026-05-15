import type { Family } from "./types";

type FamilyMeta = {
  family: Family | "all";
  label: string;
  short: string;
  tone: string;
};

export const SUBTYPE_CHIPS: FamilyMeta[] = [
  { family: "all", label: "All", short: "All", tone: "neutral" },
  { family: "binance_price", label: "Price", short: "Price", tone: "violet" },
  { family: "fdv_after_launch", label: "Launch", short: "Launch", tone: "sky" },
  { family: "holdings_event", label: "Holdings", short: "Holdings", tone: "amber" },
  { family: "public_sale", label: "Sale", short: "Sale", tone: "emerald" },
  { family: "subjective", label: "Subjective", short: "Subj.", tone: "rose" },
  { family: "unmatched", label: "Unmatched", short: "Other", tone: "zinc" },
];

const META_BY_FAMILY: Record<Family, FamilyMeta> = SUBTYPE_CHIPS.reduce(
  (acc, c) => {
    if (c.family !== "all") acc[c.family] = c;
    return acc;
  },
  {} as Record<Family, FamilyMeta>,
);

export function familyMeta(f: Family): FamilyMeta {
  return META_BY_FAMILY[f] ?? META_BY_FAMILY.unmatched;
}

export const FAMILY_TONE_CLASSES: Record<string, string> = {
  violet: "bg-violet-500/15 text-violet-300 ring-violet-400/30",
  sky: "bg-sky-500/15 text-sky-300 ring-sky-400/30",
  amber: "bg-amber-500/15 text-amber-300 ring-amber-400/30",
  emerald: "bg-emerald-500/15 text-emerald-300 ring-emerald-400/30",
  rose: "bg-rose-500/15 text-rose-300 ring-rose-400/30",
  zinc: "bg-zinc-500/15 text-zinc-300 ring-zinc-400/30",
  neutral: "bg-zinc-700/40 text-zinc-100 ring-zinc-500/40",
};
