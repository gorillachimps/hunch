"""
Polymarket V2 builder-code smoke test.

Verifies end-to-end that orders signed and posted through the V2 CLOB
SDK carry your builder_code for retro attribution. Places a tiny
non-fillable limit order, fetches it back, prints the response, and
cancels.

Setup:
  1. pip install py_clob_client_v2 requests python-dotenv
  2. Get builder code at https://polymarket.com/settings?tab=builder
  3. Fund the wallet with ~$5 pUSD. Easiest path: deposit USDC at
     polymarket.com once and the V2 frontend auto-wraps to pUSD.
     API-only users would wrap manually via CollateralOnramp.wrap().
  4. Copy .env.example to .env and fill it in.

Run:
  python smoke_test.py
"""

import json
import os
import sys
import time

import requests
from dotenv import load_dotenv
from py_clob_client_v2 import (
    ApiCreds,
    ClobClient,
    OrderArgs,
    OrderType,
    PartialCreateOrderOptions,
    Side,
)
from py_clob_client_v2.clob_types import BuilderTradeParams, OrderPayload

load_dotenv()

CLOB_HOST = os.getenv("POLY_CLOB_HOST", "https://clob.polymarket.com")
GAMMA_HOST = "https://gamma-api.polymarket.com"
CHAIN_ID = int(os.getenv("POLY_CHAIN_ID", "137"))

PK = os.environ["POLY_PK"]
BUILDER_CODE = os.environ["POLY_BUILDER_CODE"]
FUNDER = os.getenv("POLY_FUNDER") or None
SIG_TYPE = int(os.getenv("POLY_SIG_TYPE", "0"))


def pick_test_market() -> dict:
    r = requests.get(
        f"{GAMMA_HOST}/markets",
        params={
            "active": "true",
            "closed": "false",
            "limit": 50,
            "order": "volume24hr",
            "ascending": "false",
        },
        timeout=15,
    )
    r.raise_for_status()
    for m in r.json():
        if m.get("closed") or not m.get("active"):
            continue
        raw = m.get("clobTokenIds")
        if not raw:
            continue
        ids = json.loads(raw) if isinstance(raw, str) else raw
        if not ids:
            continue
        return {
            "question": m.get("question"),
            "token_id": ids[0],
            "neg_risk": bool(m.get("negRisk")),
        }
    raise RuntimeError("no suitable market found")


def dump(label: str, value) -> None:
    print(f"  {label}: {json.dumps(value, indent=2, default=str)}")


def main() -> int:
    print(f"CLOB host:    {CLOB_HOST}")
    print(f"Chain id:     {CHAIN_ID}")
    print(f"Builder code: {BUILDER_CODE}")
    print(f"Sig type:     {SIG_TYPE}")
    print(f"Funder:       {FUNDER or '(EOA)'}\n")

    api_key = os.getenv("CLOB_API_KEY")
    api_secret = os.getenv("CLOB_SECRET")
    api_pass = os.getenv("CLOB_PASS_PHRASE")
    if api_key and api_secret and api_pass:
        creds = ApiCreds(api_key=api_key, api_secret=api_secret, api_passphrase=api_pass)
        print("Using API credentials from .env (bound to deposit wallet)\n")
    else:
        print("No CLOB_API_KEY in .env — deriving from L1 (only works for EOA setups)\n")
        bootstrap = ClobClient(
            host=CLOB_HOST, chain_id=CHAIN_ID, key=PK,
            signature_type=SIG_TYPE, funder=FUNDER,
        )
        creds = bootstrap.create_or_derive_api_key()

    client = ClobClient(
        host=CLOB_HOST, chain_id=CHAIN_ID, key=PK, creds=creds,
        signature_type=SIG_TYPE, funder=FUNDER,
    )

    market = pick_test_market()
    print(f"Market:  {market['question']}")
    print(f"Token:   {market['token_id'][:24]}...")
    tick = client.get_tick_size(market["token_id"])
    neg_risk = client.get_neg_risk(market["token_id"])
    print(f"Tick:    {tick}   negRisk: {neg_risk}\n")

    # $0.01 × 5 = $0.05 commitment, far enough below mid that it won't fill.
    test_price = 0.01
    test_size = 5

    print(f"[1/3] place BUY {test_size}@${test_price} builder_code={BUILDER_CODE[:10]}...")
    resp = client.create_and_post_order(
        order_args=OrderArgs(
            token_id=market["token_id"],
            price=test_price,
            side=Side.BUY,
            size=test_size,
            builder_code=BUILDER_CODE,
        ),
        options=PartialCreateOrderOptions(tick_size=tick, neg_risk=neg_risk),
        order_type=OrderType.GTC,
    )
    dump("response", resp)

    if not isinstance(resp, dict) or not resp.get("success"):
        print("\nOrder rejected. Common causes:")
        print("  - wallet has 0 pUSD balance (deposit at polymarket.com)")
        print("  - builder_code not registered for this address")
        print("  - signature_type mismatch (try POLY_SIG_TYPE=1 for Safe, 2 for Magic)")
        return 1

    order_id = resp.get("orderID") or resp.get("orderId")
    if not order_id:
        print("\nNo orderID in response; cannot verify.")
        return 1

    time.sleep(1)

    print(f"\n[2/3] fetch order {order_id}")
    dump("detail", client.get_order(order_id))

    print(f"\n[3/3] cancel")
    dump("response", client.cancel_order(OrderPayload(orderID=order_id)))

    print(
        "\nInspect the order detail above — the `builder` field should equal "
        f"your code ({BUILDER_CODE[:10]}...).\n"
        "For filled-trade attribution use:\n"
        "  client.get_builder_trades(BuilderTradeParams(builder_code=BUILDER_CODE))"
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
