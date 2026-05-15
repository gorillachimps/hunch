type Props = {
  rc: number | null;
};

function tone(rc: number) {
  if (rc >= 80) return { fg: "text-emerald-200", bg: "bg-emerald-500/35", ring: "ring-emerald-400/30" };
  if (rc >= 60) return { fg: "text-sky-200", bg: "bg-sky-500/35", ring: "ring-sky-400/30" };
  if (rc >= 40) return { fg: "text-amber-200", bg: "bg-amber-500/35", ring: "ring-amber-400/30" };
  return { fg: "text-rose-200", bg: "bg-rose-500/30", ring: "ring-rose-400/30" };
}

export function RcBar({ rc }: Props) {
  if (rc == null || !isFinite(rc)) {
    return <div className="text-[11px] text-muted-2 tabular">—</div>;
  }
  const v = Math.max(0, Math.min(100, rc));
  const t = tone(v);
  return (
    <div className={`relative h-5 w-full overflow-hidden rounded-md bg-zinc-800/60 ring-1 ${t.ring}`}>
      <div className={`absolute inset-y-0 left-0 ${t.bg}`} style={{ width: `${v}%` }} />
      <div className="absolute inset-0 flex items-center justify-center">
        <span className={`tabular text-[11px] font-semibold ${t.fg}`}>{v.toFixed(0)}</span>
      </div>
    </div>
  );
}
