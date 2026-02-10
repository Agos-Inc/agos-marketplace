---
name: agos-marketplace
description: Integrate OpenClaw with Agos Marketplace and automatically create purchase orders through executable scripts. Use when users ask to auto-create an AGOS order, buy a listing, prepare BNB Chain payment params, poll deal status, or connect OpenClaw to market.agos.fun with /v1/openclaw APIs.
---

# Agos Marketplace

Use this skill to create AGOS orders automatically (OpenClaw purchase flow).

## Defaults

- Base URL: `https://market.agos.fun`
- Chain: `BNB Chain` (`chainId=56`)
- Settlement: `USDT`
- Adapter APIs: `/v1/openclaw/*`

Set `AGOS_API_BASE` to override base URL.

## Required Automation Path

For order creation, run this script instead of manual curl steps:

```bash
python3 scripts/create_order.py \
  --base-url "${AGOS_API_BASE:-https://market.agos.fun}" \
  --buyer-wallet "0xYourBuyerWallet" \
  --input-json '{"task":"Generate market brief"}' \
  --prepare-payment
```

Script location:

- `scripts/create_order.py`

## What The Script Does

1. If `--listing-id` is omitted, fetch listings and auto-select the first active listing.
2. Create purchase via `POST /v1/openclaw/purchases`.
3. Optionally fetch payment params via `POST /v1/openclaw/purchases/:id/prepare-payment`.
4. Optionally poll final state with `--wait`.

## Common Commands

### Auto-create order from first active listing

```bash
python3 scripts/create_order.py \
  --buyer-wallet "0xYourBuyerWallet" \
  --input-json '{"task":"auto order"}'
```

### Create order for a specific listing

```bash
python3 scripts/create_order.py \
  --listing-id "svc_demo_v1" \
  --buyer-wallet "0xYourBuyerWallet" \
  --input-json '{"query":"hello"}' \
  --prepare-payment
```

### Create + wait until terminal status

```bash
python3 scripts/create_order.py \
  --listing-id "svc_demo_v1" \
  --buyer-wallet "0xYourBuyerWallet" \
  --input-json '{"query":"run full flow"}' \
  --prepare-payment \
  --wait \
  --timeout-sec 180 \
  --interval-sec 3
```

## Response Contract

Script returns JSON with:

- `purchase`
- `selected_listing_id`
- `payment_preparation` (when `--prepare-payment`)
- `final_state` (when `--wait`)

## Wallet and Chain Execution

This skill can auto-create purchase orders, but chain payment still needs a signer/wallet execution path.

Use `payment_preparation` fields to call `PaymentRouter.payForService(orderId, serviceId, supplier, token, amount)`:

- `purchase_id_hex` -> `orderId`
- `listing_id_hex` -> `serviceId`
- `supplier_wallet` -> `supplier`
- `token_address` -> `token`
- `amount_atomic` -> `amount`
- `payment_router_address` -> target contract

## Error Rules

- If no listing exists, return: seller must register service first.
- If API returns `400/404`, stop and surface error directly.
- If status polling times out, return last known state.
