"""
Phase 0b — rules parser.

Reads data/crypto-events.json, classifies each active market into a
resolution-source family, extracts structured metadata. Output:
data/parsed-markets.json.

Families on day one (covers ~88% of crypto-vertical volume):
  binance_price       — "X (Y/USDT) Nm candle High/Low" templates
  fdv_after_launch    — "<Project> FDV above $X one day after launch"
  holdings_event      — MSTR / Satoshi / on-chain holder watches
  public_sale         — "Over $X committed to <Project> public sale"
  subjective          — explicitly resolves by "consensus of credible reporting"
  unmatched           — flagged ambiguous, surfaces rules link in UI
"""

import json
import re
from pathlib import Path
from collections import Counter, defaultdict

DUMP = Path(__file__).parent / "data" / "crypto-events.json"
OUT = Path(__file__).parent / "data" / "parsed-markets.json"


# ---------- helpers ----------

_SUFFIXES = {"k": 1_000, "m": 1_000_000, "b": 1_000_000_000, "t": 1_000_000_000_000}


def _parse_dollar_threshold(text: str):
    """Find the first $-prefixed numeric threshold. Returns float or None.
    Suffix (k/m/b/t) must be immediately attached to the number (no space)
    and followed by a word boundary — otherwise we'd grab the 'b' in
    '$250,000 by Dec...' and end up with $250 trillion."""
    m = re.search(r"\$\s*([\d,]+(?:\.\d+)?)([kKmMbBtT])?\b", text)
    if not m:
        return None
    val = float(m.group(1).replace(",", ""))
    suffix = (m.group(2) or "").lower()
    if suffix in _SUFFIXES:
        val *= _SUFFIXES[suffix]
    return val


def _infer_op_from_question(q: str) -> str:
    qlow = q.lower()
    if any(w in qlow for w in ("dip", "below", "under", "fall to", "drop to", "less than", "<", " < ")):
        return "<="
    return ">="


# ---------- family parsers ----------


def parse_binance_price(m: dict):
    desc = m.get("description") or ""
    if not re.search(r"binance.*?[A-Z]{2,6}/USDT", desc, re.I | re.S):
        return None

    pair_m = re.search(r"\(([A-Z]{2,6})/USDT\)", desc) or re.search(
        r"binance[^A-Z]{0,80}([A-Z]{2,6})/USDT", desc, re.I | re.S
    )
    symbol = pair_m.group(1).upper() if pair_m else None

    interval_m = re.search(r"(\d+)\s*minute", desc, re.I)
    interval = f"{interval_m.group(1)}m" if interval_m else "1m"

    field = "high"
    if re.search(r'"low"\s*price', desc, re.I):
        field = "low"
    elif re.search(r'"close"\s*price', desc, re.I):
        field = "close"

    q = m.get("question") or ""
    threshold = _parse_dollar_threshold(q)
    if threshold is None:
        return None

    op = _infer_op_from_question(q)
    if re.search(r"less than or equal|equal to or less", desc, re.I):
        op = "<="
    elif re.search(r"equal to or greater|greater than or equal", desc, re.I):
        op = ">="

    return {
        "family": "binance_price",
        "source": "binance",
        "symbol": symbol,
        "pair": f"{symbol}/USDT" if symbol else None,
        "candle_interval": interval,
        "candle_field": field,
        "threshold_value": threshold,
        "threshold_op": op,
        "currency": "USD",
    }


def parse_fdv_after_launch(m: dict):
    q = m.get("question") or ""
    desc = m.get("description") or ""
    if not (re.search(r"\bFDV\b", q, re.I) and re.search(r"one day after launch", q + desc, re.I)):
        return None

    proj_m = re.match(r"^([A-Za-z][\w.\-]*(?:\s[A-Za-z][\w.\-]*)?)\s+FDV", q)
    project = proj_m.group(1).strip() if proj_m else None

    threshold = _parse_dollar_threshold(q)
    if threshold is None:
        return None

    op = ">="
    if re.search(r"\babove\b", q, re.I):
        op = ">="
    elif re.search(r"\bbelow\b", q, re.I):
        op = "<="

    return {
        "family": "fdv_after_launch",
        "source": "fdv_t_plus_24h",
        "project": project,
        "threshold_value": threshold,
        "threshold_op": op,
        "currency": "USD",
        "observation_window": "24h_after_launch",
    }


def parse_holdings_event(m: dict):
    q = m.get("question") or ""
    pat = re.match(
        r"^(MicroStrategy|MSTR|Satoshi|Bitmine|Strategy Inc|Tether|BlackRock)"
        r"\s+(sells|moves|buys|holds|reveals|reaches)\s*(any\s+)?"
        r"(Bitcoin|Ethereum|BTC|ETH|USDT)?",
        q,
        re.I,
    )
    if not pat:
        # Satoshi-style "Will Satoshi move any Bitcoin"
        pat2 = re.match(
            r"^Will\s+(Satoshi|MicroStrategy|MSTR|Bitmine)\s+(move|sell|buy|hold|reveal)\s+(any\s+)?"
            r"(Bitcoin|Ethereum|BTC|ETH)?",
            q,
            re.I,
        )
        if not pat2:
            return None
        entity, action, _, asset = pat2.groups()
    else:
        entity, action, _, asset = pat.groups()

    desc = m.get("description") or ""
    src = "on_chain_observation"
    if "arkham" in desc.lower():
        src = "arkham_intel_explorer"
    elif re.search(r"consensus.*?report|credible.*?report", desc, re.I):
        src = "polymarket_team_judgment"

    return {
        "family": "holdings_event",
        "source": src,
        "entity": entity,
        "action": action.lower(),
        "asset": asset,
    }


def parse_public_sale(m: dict):
    q = m.get("question") or ""
    if not re.search(r"public\s*sale|presale|raise on \w+|committed", q, re.I):
        return None
    if "FDV" in q:  # FDV markets handled elsewhere
        return None

    threshold = _parse_dollar_threshold(q)
    if threshold is None:
        return None

    proj_m = re.search(r"(?:committed to (?:the )?|raise on )([A-Za-z][\w.\-]+)", q, re.I)
    project = proj_m.group(1) if proj_m else None

    desc = m.get("description") or ""
    url_m = re.search(r"(https?://[^\s\"]+)", desc)
    source_url = url_m.group(1).rstrip(".,") if url_m else None

    return {
        "family": "public_sale",
        "source": "project_public_sale_page",
        "project": project,
        "threshold_value": threshold,
        "threshold_op": ">=",
        "currency": "USD",
        "source_url": source_url,
    }


def parse_subjective(m: dict):
    desc = m.get("description") or ""
    if re.search(r"consensus.*?(report|reporting)|credible.*?(report|reporting)", desc, re.I):
        return {
            "family": "subjective",
            "source": "polymarket_team_judgment",
            "ambiguity": True,
            "note": "Resolves by consensus of credible reporting; no live Δ.",
        }
    return None


PARSERS = (
    parse_binance_price,
    parse_fdv_after_launch,
    parse_holdings_event,
    parse_public_sale,
    parse_subjective,
)


def parse_market(m: dict, event_title: str | None = None) -> dict:
    out = {
        "id": m.get("id"),
        "question": m.get("question"),
        "slug": m.get("slug"),
        "event_title": event_title,
        "end_date": m.get("endDate"),
        "volume_total": float(m.get("volumeNum") or 0),
        "volume_24h": float(m.get("volume24hr") or 0),
        "liquidity": float(m.get("liquidityClob") or m.get("liquidity") or 0),
        "best_bid": float(m.get("bestBid") or 0),
        "best_ask": float(m.get("bestAsk") or 0),
        "last_price": float(m.get("lastTradePrice") or 0),
        "implied_yes": float(json.loads(m.get("outcomePrices", "[]"))[0]) if m.get("outcomePrices") else None,
        "one_hour_change": float(m.get("oneHourPriceChange") or 0),
        "one_day_change": float(m.get("oneDayPriceChange") or 0),
        "one_week_change": float(m.get("oneWeekPriceChange") or 0),
        "one_month_change": float(m.get("oneMonthPriceChange") or 0),
        "neg_risk": bool(m.get("negRisk")),
        "tick_size": m.get("orderPriceMinTickSize"),
    }

    raw_ids = m.get("clobTokenIds")
    if raw_ids:
        try:
            ids = json.loads(raw_ids) if isinstance(raw_ids, str) else raw_ids
            out["token_yes"] = ids[0] if len(ids) > 0 else None
            out["token_no"] = ids[1] if len(ids) > 1 else None
        except Exception:
            pass

    parsed = None
    for fn in PARSERS:
        try:
            parsed = fn(m)
        except Exception:
            parsed = None
        if parsed:
            break

    if parsed:
        out.update(parsed)
        out.setdefault("ambiguity", False)
    else:
        out["family"] = "unmatched"
        out["source"] = None
        out["ambiguity"] = True

    return out


# ---------- main ----------


def main():
    events = json.loads(DUMP.read_text())
    rows = []
    for e in events:
        for m in e.get("markets", []):
            if not m.get("active") or m.get("closed"):
                continue
            if not (m.get("description") or "").strip():
                continue
            rows.append(parse_market(m, event_title=e.get("title")))

    OUT.write_text(json.dumps(rows, separators=(",", ":")))

    by_family = Counter(r["family"] for r in rows)
    vol_by_family = defaultdict(float)
    for r in rows:
        vol_by_family[r["family"]] += r["volume_total"]
    total_vol = sum(vol_by_family.values()) or 1

    print(f"Wrote {OUT}")
    print(f"  parsed: {len(rows)} markets")
    print(f"  size:   {OUT.stat().st_size / 1024 / 1024:.2f} MB\n")

    print(f'{"family":<22}{"count":>8}{"%n":>8}{"volume":>16}{"%vol":>8}')
    print("-" * 64)
    order = ["binance_price", "fdv_after_launch", "holdings_event", "public_sale", "subjective", "unmatched"]
    for fam in order:
        n = by_family.get(fam, 0)
        v = vol_by_family.get(fam, 0)
        if n == 0:
            continue
        print(f'{fam:<22}{n:>8}{100*n/len(rows):>7.1f}%${v:>14,.0f}{100*v/total_vol:>7.1f}%')

    covered_pct = 100 * (1 - vol_by_family["unmatched"] / total_vol)
    print(f"\nCoverage: {covered_pct:.1f}% of volume parsed into a family.")


if __name__ == "__main__":
    main()
