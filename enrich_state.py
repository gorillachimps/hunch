"""
Phase 0c — live state enrichment.

Reads data/parsed-markets.json. For each market, queries the resolution
source (where feasible) and computes the live divergence between Polymarket's
implied probability and the live state of the criterion.

v1 fetchers:
  binance_price  — Binance public ticker; distance and trigger_pct vs threshold
  others         — placeholder state; show rules link in UI

Output: data/enriched-markets.json
"""

import json
import time
from pathlib import Path
from typing import Optional

import requests

IN = Path(__file__).parent / "data" / "parsed-markets.json"
OUT = Path(__file__).parent / "data" / "enriched-markets.json"

BINANCE = "https://api.binance.com/api/v3/ticker/price"


def fetch_binance_prices(symbols: list[str]) -> dict[str, float]:
    """Single batch call; Binance returns all symbol prices when no symbol filter
    is provided. Filter to symbols we care about."""
    r = requests.get(BINANCE, timeout=15)
    r.raise_for_status()
    data = r.json()  # list of {symbol, price}
    wanted = set(symbols)
    return {row["symbol"]: float(row["price"]) for row in data if row["symbol"] in wanted}


def enrich_binance_price(m: dict, prices: dict[str, float]) -> dict:
    pair = m.get("pair")  # e.g. "BTC/USDT"
    if not pair:
        return {"state": "no_pair", "ambiguity": True}
    binance_symbol = pair.replace("/", "")  # "BTCUSDT"
    spot = prices.get(binance_symbol)
    if spot is None:
        return {"state": "symbol_not_on_binance", "ambiguity": True}

    threshold = m["threshold_value"]
    op = m["threshold_op"]

    # Distance: positive means spot is on the "wrong side" of threshold
    # (i.e., further from triggering). Negative or zero means already triggered.
    if op == ">=":
        already_triggered = spot >= threshold
        distance_to_trigger = (threshold - spot) / threshold  # +ve fraction needed to rise
    else:  # "<="
        already_triggered = spot <= threshold
        distance_to_trigger = (spot - threshold) / threshold  # +ve fraction needed to fall

    return {
        "state": "live",
        "current_value": spot,
        "current_value_unit": "USD",
        "threshold_value": threshold,
        "threshold_op": op,
        "already_triggered": already_triggered,
        "distance_to_trigger_pct": distance_to_trigger,  # fraction; e.g. 0.716 = needs +71.6%
    }


def enrich_passthrough(m: dict, fam: str) -> dict:
    return {
        "state": "deferred",
        "ambiguity": True,
        "reason": {
            "fdv_after_launch": "Token not yet launched, or FDV fetcher pending wiring.",
            "public_sale": "Per-project sale-page fetcher pending wiring.",
            "holdings_event": "On-chain/Arkham fetcher pending wiring.",
            "subjective": "Resolves by Polymarket-team consensus reading; no machine-readable Δ.",
            "unmatched": "Bespoke market; rules text on Polymarket.",
        }.get(fam, "Pending wiring."),
    }


def compute_resolution_confidence(m: dict, live: dict) -> Optional[float]:
    """Composite 0-100 score combining how close the criterion is to triggering,
    how much time is left, and the volume signal. Higher = more 'about to flip'.
    Only computed when we have a live price comparison."""
    if live.get("state") != "live":
        return None

    dist = live.get("distance_to_trigger_pct")
    if dist is None:
        return None

    # 1. Distance score: 100 if already triggered, decays exponentially with distance.
    if live["already_triggered"]:
        dist_score = 100.0
    else:
        # 0% distance → 80; 50% → ~30; 100% → ~10; 200% → ~1
        dist_score = 100.0 * pow(2.71828, -2.5 * abs(dist))

    # 2. Time-pressure: closer to resolution = more weight on current state
    end = m.get("end_date")
    days_left = None
    if end:
        try:
            from datetime import datetime, timezone
            t = datetime.fromisoformat(end.replace("Z", "+00:00"))
            days_left = max(0, (t - datetime.now(timezone.utc)).total_seconds() / 86400)
        except Exception:
            days_left = None

    if days_left is None:
        time_score = 50.0
    elif days_left < 1:
        time_score = 100.0
    elif days_left < 7:
        time_score = 90.0
    elif days_left < 30:
        time_score = 70.0
    elif days_left < 90:
        time_score = 50.0
    else:
        time_score = 30.0

    # 3. Volume signal: log-scaled, normalized
    vol = m.get("volume_total") or 0
    if vol < 1000:
        vol_score = 10.0
    elif vol < 10_000:
        vol_score = 30.0
    elif vol < 100_000:
        vol_score = 50.0
    elif vol < 1_000_000:
        vol_score = 70.0
    else:
        vol_score = 90.0

    # Weighted blend: distance dominates, time matters, volume least
    rc = 0.55 * dist_score + 0.30 * time_score + 0.15 * vol_score
    return round(rc, 1)


def main() -> None:
    rows = json.loads(IN.read_text())

    # 1. Pre-fetch Binance prices in one call
    binance_pairs = {r["pair"].replace("/", "") for r in rows
                     if r.get("family") == "binance_price" and r.get("pair")}
    print(f"Fetching Binance prices for {len(binance_pairs)} symbols...")
    t0 = time.time()
    prices = fetch_binance_prices(list(binance_pairs))
    print(f"  got {len(prices)} symbols in {time.time()-t0:.1f}s")

    # 2. Enrich each market
    enriched = []
    family_state_count: dict = {}
    for r in rows:
        fam = r.get("family")
        if fam == "binance_price":
            live = enrich_binance_price(r, prices)
        else:
            live = enrich_passthrough(r, fam)

        rc = compute_resolution_confidence(r, live)
        out = dict(r)
        out["live"] = live
        out["resolution_confidence"] = rc
        enriched.append(out)

        key = f'{fam}:{live.get("state")}'
        family_state_count[key] = family_state_count.get(key, 0) + 1

    OUT.write_text(json.dumps(enriched, separators=(",", ":")))

    print(f"\nWrote {OUT}")
    print(f"  rows: {len(enriched)}  size: {OUT.stat().st_size/1024/1024:.2f} MB")
    print()
    print(f"{'family:state':<40}{'count':>8}")
    print("-" * 48)
    for k in sorted(family_state_count, key=lambda x: -family_state_count[x]):
        print(f"  {k:<38}{family_state_count[k]:>8}")


if __name__ == "__main__":
    main()
