// Copies the Phase-0 enriched snapshot from the parent pipeline dir
// (../data/enriched-markets.json) into ./data/ so that builds running with
// ui/ as their working directory (Vercel, Docker, etc.) have the file
// available. No-op if the parent file doesn't exist — lib/data.ts already
// falls back to the in-repo copy.
//
// Also writes ./data/snapshot-meta.json with the *source* mtime so lib/data.ts
// can report an accurate snapshot age. We can't trust the bundled file's mtime
// at runtime: Vercel's serverless packaging normalises mtimes through the
// build pipeline (often to epoch or build-time), so /api/health would always
// trip the staleness check otherwise.
import { copyFileSync, existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";

const SRC = path.resolve(process.cwd(), "..", "data", "enriched-markets.json");
const DST_DIR = path.resolve(process.cwd(), "data");
const DST = path.resolve(DST_DIR, "enriched-markets.json");
const META = path.resolve(DST_DIR, "snapshot-meta.json");

function writeMeta(snapshotMtimeMs) {
  writeFileSync(
    META,
    JSON.stringify(
      {
        // ISO timestamp of when the SOURCE snapshot was generated. This is
        // what /api/health checks against. Build time is recorded separately
        // so we can tell "stale source data" from "stale build".
        snapshotAt: new Date(snapshotMtimeMs).toISOString(),
        syncedAt: new Date().toISOString(),
      },
      null,
      2,
    ),
  );
}

if (!existsSync(SRC)) {
  if (existsSync(DST)) {
    if (!existsSync(META)) {
      // Bootstrap meta from the destination file's mtime if we somehow have
      // the data file but no sidecar (e.g. first deploy after this change).
      writeMeta(statSync(DST).mtimeMs);
    }
    const meta = JSON.parse(readFileSync(META, "utf-8"));
    const age =
      (Date.now() - Date.parse(meta.snapshotAt)) / 1000 / 60;
    console.log(
      `[sync-data] parent snapshot missing; keeping existing ./data/enriched-markets.json (source ${age.toFixed(0)}m old per snapshot-meta.json)`,
    );
  } else {
    console.warn(
      "[sync-data] parent snapshot missing and ./data is empty — build will likely fail. Run the Phase-0 pipeline (../enrich_state.py) or commit a snapshot into ./data/.",
    );
  }
  process.exit(0);
}

mkdirSync(DST_DIR, { recursive: true });
const srcMtimeMs = statSync(SRC).mtimeMs;
copyFileSync(SRC, DST);
writeMeta(srcMtimeMs);
const bytes = statSync(DST).size;
console.log(
  `[sync-data] copied ${(bytes / 1024 / 1024).toFixed(2)} MB to ./data/enriched-markets.json (source mtime ${new Date(srcMtimeMs).toISOString()})`,
);
