# Claw Marketplace MVP Technical Spec (OpenClaw, BSC-only)

## 0. OpenClaw Compliance Profile

This spec is aligned with OpenClaw submission constraints:
- On-chain proof is mandatory.
- Chain proof can be on `BSC` or `opBNB`; this project uses `BSC` only.
- Submission must be reproducible via public repo + demo + setup docs.
- Token launch mechanics are excluded from the scope.

## 1. Architecture

Components:
- `Registry API`: service registration and discovery.
- `Order API`: order creation, query, and status.
- `Payment Listener`: listens to `PaymentRouter.OrderPaid`.
- `Execution Dispatcher`: invokes supplier endpoint after payment verification.
- `Supplier Agent Endpoint`: executes task and returns structured output.
- `Demo UI`: service browse, payment action, status timeline, tx proof panel.

Flow:
1. Supplier registers `ServiceManifest`.
2. Consumer creates `Order` via API.
3. Consumer pays `USDT` through `PaymentRouter` on BSC.
4. Listener verifies event and marks order `PAID`.
5. Dispatcher sends task to supplier endpoint and marks `RUNNING`.
6. Supplier callback updates order to `COMPLETED` or `FAILED`.

## 2. Chain and Token Constraints

- `chainId`: `56` (`BSC` mainnet). Optional `97` testnet only for dry runs.
- `token`: `USDT` only.
- `payment contract`: `PaymentRouter`.
- `proof source of truth`: only `OrderPaid` event from `PaymentRouter`.

## 3. Canonical ID and Amount Rules

### ID Mapping (`string <-> bytes32`)

To avoid ambiguity between API IDs and contract IDs:
- API `order_id` remains human-readable string (example: `ord_20260206_0001`).
- API `service_id` remains human-readable string (example: `svc_pdf_summarizer_v1`).
- Contract values are computed deterministically:
  - `order_id_hex = keccak256(utf8(order_id))`
  - `service_id_hex = keccak256(utf8(service_id))`
- Backend must persist both string and hex forms and verify both on event ingestion.

### Amount Representation

- API display amount uses decimal string (`amount_usdt`: `"1.0"`).
- Settlement verification uses integer atomic amount (`amount_atomic`: `"1000000000000000000"` for USDT 18 decimals).
- Token decimals are explicit (`token_decimals = 18`) and must be included in conversion logic.

## 4. Canonical Data Models

## ServiceManifest
```json
{
  "service_id": "svc_pdf_summarizer_v1",
  "service_id_hex": "0x...",
  "name": "PDF Summarizer",
  "description": "Summarize a PDF from URL input",
  "input_schema": {
    "type": "object",
    "properties": { "pdf_url": { "type": "string" } },
    "required": ["pdf_url"]
  },
  "output_schema": {
    "type": "object",
    "properties": { "summary": { "type": "string" } },
    "required": ["summary"]
  },
  "price_usdt": "1.0",
  "price_atomic": "1000000000000000000",
  "token_decimals": 18,
  "endpoint": "https://supplier-agent.example.com/task",
  "supplier_wallet": "0xSupplierAddress",
  "version": "1.0.0",
  "is_active": true
}
```

## Order
```json
{
  "order_id": "ord_20260206_0001",
  "order_id_hex": "0x...",
  "service_id": "svc_pdf_summarizer_v1",
  "service_id_hex": "0x...",
  "buyer_wallet": "0xBuyerAddress",
  "supplier_wallet": "0xSupplierAddress",
  "amount_usdt": "1.0",
  "amount_atomic": "1000000000000000000",
  "token_decimals": 18,
  "token_address": "0xUSDT",
  "chain_id": 56,
  "status": "CREATED",
  "input_payload": { "pdf_url": "https://example.com/a.pdf" },
  "result_payload": null,
  "error_message": null,
  "tx_hash": null,
  "created_at": "2026-02-06T14:00:00Z",
  "updated_at": "2026-02-06T14:00:00Z"
}
```

## PaymentProof
```json
{
  "order_id": "ord_20260206_0001",
  "order_id_hex": "0x...",
  "service_id": "svc_pdf_summarizer_v1",
  "service_id_hex": "0x...",
  "tx_hash": "0x...",
  "block_number": 12345678,
  "log_index": 12,
  "buyer": "0xBuyerAddress",
  "supplier": "0xSupplierAddress",
  "token": "0xUSDT",
  "amount_atomic": "1000000000000000000",
  "confirmations": 3,
  "verified_at": "2026-02-06T14:01:23Z"
}
```

## TaskRequest / TaskResponse
```json
{
  "task_request": {
    "order_id": "ord_20260206_0001",
    "service_id": "svc_pdf_summarizer_v1",
    "input": { "pdf_url": "https://example.com/a.pdf" },
    "callback_url": "https://api.claw.marketplace/v1/orders/ord_20260206_0001/callback"
  },
  "task_response": {
    "order_id": "ord_20260206_0001",
    "status": "COMPLETED",
    "output": { "summary": "..." },
    "error": null
  }
}
```

## 5. Order State Machine

States:
- `CREATED`: order exists, payment not verified.
- `PAID`: on-chain payment verified.
- `RUNNING`: supplier execution in progress.
- `COMPLETED`: successful output stored.
- `FAILED`: failed execution or invalid callback.

Transitions:
- `CREATED -> PAID`: valid `OrderPaid` event confirmed.
- `PAID -> RUNNING`: dispatcher accepted task.
- `RUNNING -> COMPLETED`: valid callback with output schema.
- `RUNNING -> FAILED`: timeout/retry exhausted/schema invalid.

Invalid transitions must be rejected and logged.

## 6. Smart Contract Interface (MVP)

## PaymentRouter function
```solidity
function payForService(
    bytes32 orderId,
    bytes32 serviceId,
    address supplier,
    address token,
    uint256 amount
) external;
```

## PaymentRouter event
```solidity
event OrderPaid(
    bytes32 indexed orderId,
    bytes32 indexed serviceId,
    address indexed buyer,
    address supplier,
    address token,
    uint256 amount,
    uint256 timestamp
);
```

Verification rules:
1. Event contract address must match configured `PAYMENT_ROUTER_ADDRESS`.
2. `token` must equal configured `USDT_ADDRESS`.
3. `amount` must equal order `amount_atomic`.
4. Event `orderId` must equal `keccak256(utf8(order_id))`.
5. Event `serviceId` must equal `keccak256(utf8(service_id))`.
6. `buyer` and `supplier` must match order record.
7. Confirmation count must reach `MIN_CONFIRMATIONS` before status update.

## 7. REST API (MVP)

## Registry API
- `POST /v1/services`
  - Register service manifest.
- `GET /v1/services`
  - List active services.
- `GET /v1/services/{service_id}`
  - Get detail.

## Order API
- `POST /v1/orders`
  - Create order in `CREATED`.
- `GET /v1/orders?status=...`
  - List orders, optional status filter.
- `GET /v1/orders/{order_id}`
  - Query current status/result.
- `GET /v1/orders/by-hex/{order_id_hex}`
  - Query order by on-chain `bytes32` id.
- `POST /v1/orders/{order_id}/callback`
  - Supplier posts execution result.
- `POST /v1/internal/orders/{order_id}/transition`
  - Internal worker-only state transition endpoint.
- `POST /v1/internal/orders/{order_id}/payment-event`
  - Internal worker endpoint for idempotent payment event ingestion.

## System API
- `GET /v1/health`
  - Health check for API, DB, chain listener lag.

## OpenClaw Adapter API
- `GET /v1/openclaw/listings`
  - List purchasable listings for OpenClaw.
- `GET /v1/openclaw/listings/{listing_id}`
  - Get listing detail.
- `POST /v1/openclaw/purchases`
  - Create purchase (maps to order creation).
- `GET /v1/openclaw/purchases/{purchase_id}`
  - Query purchase status/result.
- `GET /v1/openclaw/purchases/by-hex/{order_id_hex}`
  - Query purchase by on-chain order hex id.
- `POST /v1/openclaw/purchases/{purchase_id}/prepare-payment`
  - Return on-chain payment parameters for `payForService`.

## 8. Idempotency and Reliability Rules

- `order_id` is globally unique and immutable.
- Duplicate `OrderPaid` events for same `order_id` are ignored after first success.
- Canonical payment event uniqueness key: `(tx_hash, log_index)`.
- Dispatcher uses idempotency key: `dispatch-{order_id}`.
- Callback can be accepted once after `RUNNING`; duplicate callbacks are ignored.
- Retry policy:
  - Supplier call timeout: `30s`.
  - Max retries: `1`.
  - Final failure sets `FAILED` with error code.
- Reorg safety:
  - Backfill from the last safe block on restart.
  - Roll back `PAID` only when chain finality check invalidates the event.

## 9. Storage Schema (Prisma + PostgreSQL)

Tables:
- `services`
  - `service_id (pk)`, `service_id_hex`, `name`, `description`, `input_schema`, `output_schema`, `price_usdt`, `price_atomic`, `token_decimals`, `endpoint`, `supplier_wallet`, `version`, `is_active`, `created_at`, `updated_at`.
- `orders`
  - `order_id (pk)`, `order_id_hex`, `service_id`, `service_id_hex`, `buyer_wallet`, `supplier_wallet`, `amount_usdt`, `amount_atomic`, `token_decimals`, `token_address`, `chain_id`, `status`, `input_payload`, `result_payload`, `error_message`, `tx_hash`, `created_at`, `updated_at`.
- `payment_events`
  - `id (pk)`, `order_id`, `order_id_hex`, `tx_hash`, `block_number`, `log_index`, `raw_event_json`, `created_at`.
- `callback_nonces`
  - `nonce (pk)`, `created_at`.

Indexes:
- `orders(status, created_at)`.
- `orders(service_id, created_at)`.
- `orders(order_id_hex)`.
- unique `payment_events(tx_hash, log_index)`.

## 10. Security Baseline

- Validate all addresses as checksum format before persistence.
- Validate input/output against JSON schema.
- Callback authentication is mandatory:
  - `X-Callback-Timestamp`
  - `X-Callback-Nonce`
  - `X-Callback-Signature` (HMAC-SHA256 over body + timestamp + nonce)
- Reject callbacks with replayed nonce.
- Timestamp freshness window validation is recommended for production hardening.
- Log all state transitions with actor/source.

## 11. Observability

Metrics:
- `orders_created_total`
- `orders_paid_total`
- `orders_completed_total`
- `orders_failed_total`
- `payment_listener_block_lag`
- `supplier_exec_latency_ms`
- `callback_auth_failed_total`

Structured logs must include:
- `order_id`, `order_id_hex`, `service_id`, `tx_hash`, `status`, `error_code`.

## 12. Environment Variables

```env
NODE_ENV=development
PORT=3000
DATABASE_URL=postgres://...
RPC_URL=https://bsc-dataseed.binance.org
CHAIN_ID=56
USDT_ADDRESS=0x...
PAYMENT_ROUTER_ADDRESS=0x...
MIN_CONFIRMATIONS=3
SUPPLIER_TIMEOUT_MS=30000
DISPATCH_MAX_RETRY=1
CALLBACK_HMAC_SECRET=...
```

## 13. Test Plan (Minimum)

1. Unit: service manifest schema validation.
2. Unit: `order_id/service_id` to `bytes32` mapping determinism.
3. Unit: order state machine transition guard.
4. Integration: simulated `OrderPaid` updates order to `PAID`.
5. Integration: dispatcher -> supplier callback -> `COMPLETED`.
6. Integration: callback replay attempt is rejected.
7. Integration: timeout and retry -> `FAILED`.
8. E2E demo script: A buys B service and receives final output.

## 14. Submission Artifact Spec

- `Proof package`: `PAYMENT_ROUTER_ADDRESS`, one successful `tx_hash`, explorer links.
- `Reproducibility package`: setup commands, env template, and demo input/output sample.
- `AI Build Log`: concise notes of AI-assisted steps and human verification checkpoints.
