# OpenClaw Quick Integration (Agos SDK)

This document explains the fastest path for integrating OpenClaw agents with AGOS Marketplace.

## 1. Integration Goal

OpenClaw should only handle four steps:
- List purchasable resources (`listings`)
- Create a purchase
- Prepare on-chain payment parameters
- Poll purchase status until completion

## 2. OpenClaw Adapter API

The Marketplace exposes an OpenClaw facade:

- `GET /v1/openclaw/listings`
- `GET /v1/openclaw/listings/:listing_id`
- `POST /v1/openclaw/purchases`
- `GET /v1/openclaw/purchases/:purchase_id`
- `GET /v1/openclaw/purchases/by-hex/:order_id_hex`
- `POST /v1/openclaw/purchases/:purchase_id/prepare-payment`

Internally these map to existing `services/orders` flows, so OpenClaw does not need to know internal order-state details.

## 3. Agos SDK

SDK package:
- `@agos/agos-sdk`

Core methods:
- `listListings()`
- `getListing(listingId)`
- `createPurchase({ listing_id, buyer_wallet, input_payload })`
- `preparePayment(purchaseId)`
- `getPurchase(purchaseId)`
- `waitForPurchase(purchaseId)`

## 4. Minimal Integration Example

```ts
import { createAgosSdk } from '@agos/agos-sdk';

const sdk = createAgosSdk({
  baseUrl: 'http://localhost:3000'
});

const listings = await sdk.listListings();
const target = listings[0];
if (!target) throw new Error('no listings available');

const purchase = await sdk.createPurchase({
  listing_id: target.listing_id,
  buyer_wallet: '0x0000000000000000000000000000000000000002',
  input_payload: { query: 'hello openclaw' }
});

const payment = await sdk.preparePayment(purchase.purchase_id);
// Call PaymentRouter.payForService(...)
// orderId  = payment.purchase_id_hex
// serviceId = payment.listing_id_hex
// supplier = payment.supplier_wallet
// token    = payment.token_address
// amount   = payment.amount_atomic

const finalState = await sdk.waitForPurchase(purchase.purchase_id, {
  timeoutMs: 180_000,
  intervalMs: 3_000
});

console.log(finalState.status, finalState.result_payload);
```

## 5. Payment Parameter Mapping

`prepare-payment` response fields map to `payForService` as follows:
- `purchase_id_hex` -> `orderId`
- `listing_id_hex` -> `serviceId`
- `supplier_wallet` -> `supplier`
- `token_address` -> `token`
- `amount_atomic` -> `amount`
- `payment_router_address` -> target contract address

## 6. Integration Recommendations

- Use `Agos SDK` in agents instead of calling internal endpoints directly.
- Wrap `waitForPurchase` as an agent tool to simplify orchestration.
- Add retries and clear error handling for payment failures and timeout scenarios.
