"""
Phase 0a — Polymarket crypto-vertical market dump.

Paginates /events?tag_slug=crypto&active=true&closed=false, collects all
events (with their nested markets[] arrays), dedupes by event ID,
writes to data/crypto-events.json.

Run:
    python dump_crypto_events.py
"""

import json
import time
from pathlib import Path

import requests

GAMMA = "https://gamma-api.polymarket.com"
TAG_SLUG = "crypto"
PAGE_SIZE = 500
OUT_PATH = Path(__file__).parent / "data" / "crypto-events.json"


def fetch_page(offset: int, limit: int = PAGE_SIZE) -> list:
    r = requests.get(
        f"{GAMMA}/events",
        params={
            "tag_slug": TAG_SLUG,
            "active": "true",
            "closed": "false",
            "limit": limit,
            "offset": offset,
        },
        timeout=30,
    )
    r.raise_for_status()
    return r.json()


def main() -> None:
    by_id: dict = {}
    offset = 0
    while True:
        page = fetch_page(offset)
        new = sum(1 for e in page if e.get("id") not in by_id)
        for e in page:
            by_id[e.get("id")] = e
        print(f"  offset {offset:>5}: page={len(page):>3}  new={new:>3}  total={len(by_id):>4}")
        if len(page) < PAGE_SIZE:
            break
        offset += PAGE_SIZE
        time.sleep(0.2)

    events = list(by_id.values())
    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUT_PATH.write_text(json.dumps(events, separators=(",", ":")))

    n_markets = sum(len(e.get("markets", [])) for e in events)
    total_vol = sum(float(e.get("volume") or 0) for e in events)
    total_24h = sum(float(e.get("volume24hr") or 0) for e in events)
    total_liq = sum(float(e.get("liquidity") or 0) for e in events)

    print()
    print(f"Wrote {OUT_PATH}")
    print(f"  events:     {len(events)}")
    print(f"  markets:    {n_markets}")
    print(f"  cum vol:    ${total_vol:,.0f}")
    print(f"  24h vol:    ${total_24h:,.0f}")
    print(f"  liquidity:  ${total_liq:,.0f}")
    print(f"  file size:  {OUT_PATH.stat().st_size / 1024 / 1024:.2f} MB")


if __name__ == "__main__":
    main()
