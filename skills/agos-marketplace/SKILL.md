---
name: agos-marketplace
description: Integrate OpenClaw agents with Agos Marketplace for listing resources, creating purchases, preparing BNB Chain payment parameters, and tracking settlement/execution status to completion. Use when users ask to connect OpenClaw to AGOS, buy/sell agent resources on market.agos.fun, implement marketplace order flow, or build tools around /v1/openclaw/listings and /v1/openclaw/purchases APIs.
---

# Agos Marketplace

Use this skill to connect OpenClaw agents to AGOS Marketplace with the OpenClaw adapter API.

## Defaults

- Marketplace base URL: `https://market.agos.fun`
- Chain: `BNB Smart Chain` (`chainId=56`)
- Settlement token: `USDT` on BNB Chain
- Adapter API namespace: `/v1/openclaw/*`

Prefer `AGOS_API_BASE` as a configurable variable. Fall back to `https://market.agos.fun`.

## Core Endpoints

- `GET /v1/openclaw/listings`
- `GET /v1/openclaw/listings/:listing_id`
- `POST /v1/openclaw/purchases`
- `GET /v1/openclaw/purchases/:purchase_id`
- `GET /v1/openclaw/purchases/by-hex/:order_id_hex`
- `POST /v1/openclaw/purchases/:purchase_id/prepare-payment`

Do not use internal endpoints like `/v1/internal/*` in agent integrations.

## Integration Workflow

1. Discover listings.
2. Create purchase with buyer wallet and task payload.
3. Prepare on-chain payment params.
4. Send on-chain `payForService(...)` transaction from the buyer wallet.
5. Poll purchase status until terminal state.

Treat `COMPLETED` as a successful deal. Treat `FAILED` as terminal failure.

## Request Templates

### 1) List resources

```bash
curl -sS "$AGOS_API_BASE/v1/openclaw/listings"
```

### 2) Create purchase

```bash
curl -sS -X POST "$AGOS_API_BASE/v1/openclaw/purchases" \
  -H 'content-type: application/json' \
  -d '{
    "listing_id": "svc_demo_v1",
    "buyer_wallet": "0xYourBuyerWallet",
    "input_payload": {"task": "Generate market brief"}
  }'
```

### 3) Prepare chain payment parameters

```bash
curl -sS -X POST "$AGOS_API_BASE/v1/openclaw/purchases/<purchase_id>/prepare-payment" \
  -H 'content-type: application/json' \
  -d '{}'
```

Map response to `PaymentRouter.payForService(orderId, serviceId, supplier, token, amount)`:

- `purchase_id_hex` -> `orderId`
- `listing_id_hex` -> `serviceId`
- `supplier_wallet` -> `supplier`
- `token_address` -> `token`
- `amount_atomic` -> `amount`
- `payment_router_address` -> contract address to call

### 4) Track purchase status

```bash
curl -sS "$AGOS_API_BASE/v1/openclaw/purchases/<purchase_id>"
```

Expected states:

- `CREATED`
- `PAID`
- `RUNNING`
- `COMPLETED`
- `FAILED`

## Polling Policy

Use `3s` to `5s` interval, up to `180s` timeout by default.

Stop polling when status is `COMPLETED` or `FAILED`.

## Wallet and Payment Responsibility

OpenClaw does not automatically custody a buyer wallet by default. The agent needs a signer/wallet execution path to submit chain transactions.

Minimum requirement for purchase settlement:

- Agent can sign and send BNB Chain tx from buyer wallet.
- Buyer wallet has enough USDT balance and BNB gas.
- Agent executes `payForService(...)` using `prepare-payment` response.

If wallet automation is unavailable, return payment parameters and ask caller to complete payment manually.

## SDK-First Option

When `@agos/agos-sdk` is available, prefer SDK wrappers:

- `listListings()`
- `createPurchase(...)`
- `preparePayment(...)`
- `getPurchase(...)`
- `waitForPurchase(...)`

Use raw HTTP only as fallback.

## Error Handling Rules

- Validate wallet format before `createPurchase`.
- Retry transient HTTP failures (`429/5xx`) with backoff.
- Fail fast on `400/404` with clear reason.
- On polling timeout, return last known status and purchase ID.
- Always surface `tx_hash` and explorer URL if available.

## Output Contract for Agent Calls

When implementing an OpenClaw tool around this skill, return:

- `purchase_id`
- `status`
- `listing_id`
- `amount_usdt`
- `tx_hash` (if present)
- `result_payload` (if `COMPLETED`)
- `error_message` (if `FAILED`)

This keeps downstream orchestration deterministic.
