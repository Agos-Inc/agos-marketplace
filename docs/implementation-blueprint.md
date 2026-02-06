# Claw Marketplace Implementation Blueprint

## 1. Goal and Scope

This blueprint defines a build-ready architecture for the OpenClaw submission of Claw Marketplace.

Target:
- Chain: `BSC (chainId=56)` only
- Payment token: `USDT` only
- Payment truth source: `PaymentRouter.OrderPaid`
- Core flow: `CREATED -> PAID -> RUNNING -> COMPLETED | FAILED`

Non-goals:
- Multi-chain support
- Token launch mechanics
- Reputation and arbitration

## 2. Tech Stack

- Monorepo: `pnpm + Turborepo`
- Language: `TypeScript` end-to-end
- Smart contract: `Solidity + Hardhat + viem`
- Backend API: `Fastify + Zod + Prisma + PostgreSQL`
- Worker runtime: `Node.js + BullMQ + Redis + viem`
- Frontend: `Next.js (App Router) + wagmi + viem + Tailwind`
- Observability: `Pino` logs + Prometheus-style metrics endpoint
- Testing: `Vitest + Supertest + Playwright + Hardhat tests`

## 3. Monorepo Layout

```text
.
├── apps
│   ├── api                  # Registry/Order/Callback API
│   ├── worker               # Event listener + dispatcher
│   ├── web                  # Demo UI and wallet payment flow
│   └── supplier-mock        # Mock supplier endpoint for E2E demo
├── packages
│   ├── shared-types         # DTOs, schemas, constants, state machine
│   ├── sdk-consumer         # Consumer helper SDK
│   ├── sdk-supplier         # Supplier helper SDK
│   ├── config               # Shared env loader and validation
│   └── observability        # Logger/metrics adapters
├── contracts
│   ├── src                  # PaymentRouter.sol
│   ├── scripts              # Deploy and verify scripts
│   └── test                 # Contract tests
├── docs
│   ├── implementation-blueprint.md
│   ├── development-guide.md
│   ├── development-plan.md
│   └── development-spec.md
└── infra
    ├── docker-compose.yml   # Postgres + Redis for local
    └── env                  # env templates
```

## 4. Module Responsibilities

### 4.1 `apps/api`

Responsibilities:
- `POST /v1/services`, `GET /v1/services`, `GET /v1/services/{service_id}`
- `POST /v1/orders`, `GET /v1/orders/{order_id}`
- `POST /v1/orders/{order_id}/callback`
- `GET /v1/health`

Core rules:
- Input/output schema enforcement with `Zod`
- Immutable order identity
- State transition guard in one domain service

### 4.2 `apps/worker`

Responsibilities:
- Listen to `OrderPaid` events from `PaymentRouter`
- Verify proof and confirmations
- Transition order `CREATED -> PAID`
- Queue and dispatch supplier task
- Handle timeout/retry and terminal status

Core rules:
- Idempotency on event and dispatch
- Reorg-safe backfill on restart
- Deterministic transition logs

### 4.3 `apps/web`

Responsibilities:
- Service list and order creation
- Wallet payment flow (`payForService`)
- Real-time order timeline
- Tx proof panel (tx hash, block number, explorer link)

Core rules:
- No business logic duplication from backend
- UI reflects backend state as source of truth

### 4.4 `apps/supplier-mock`

Responsibilities:
- Simulate supplier processing
- Return callback payload for success/failure cases

Use:
- E2E demo stability
- Failure-path testing

### 4.5 `contracts`

Responsibilities:
- Implement minimal `PaymentRouter`
- Emit canonical `OrderPaid` event
- Deploy and verify contract for BSC

Core rules:
- Parameter and event consistency with backend spec
- Explicit tests for amount/address/event correctness

### 4.6 `packages`

`shared-types`
- Canonical DTOs and schema
- Order state machine and transition guard
- `string <-> bytes32` mapping helpers

`sdk-consumer`
- Create order
- Build/pay transaction
- Poll status and fetch result

`sdk-supplier`
- Validate request
- Create signed callback payload

`config`
- Typed env parsing with fail-fast boot behavior

`observability`
- Logger configuration
- Standard metric names and labels

## 5. Critical Design Decisions

### 5.1 ID Mapping

- Store human-readable IDs in DB:
  - `order_id`
  - `service_id`
- Compute on-chain IDs:
  - `order_id_hex = keccak256(utf8(order_id))`
  - `service_id_hex = keccak256(utf8(service_id))`
- Verify both string and hex forms during event ingestion

### 5.2 Amount Handling

- Business amount: `amount_usdt` string (e.g. `1.0`)
- Settlement amount: `amount_atomic` integer string (e.g. `1000000`)
- Token decimals fixed at 6 for USDT

### 5.3 Reliability Strategy

- Event uniqueness key: `(tx_hash, log_index)`
- Dispatch idempotency key: `dispatch:{order_id}`
- Callback accepted once after `RUNNING`
- Retry policy: one retry after timeout

## 6. End-to-End Runtime Flows

### 6.1 Registration Flow

1. Supplier calls `POST /v1/services`
2. API validates manifest and persists service
3. Service appears in `GET /v1/services`

### 6.2 Pay-to-Call Flow

1. Consumer creates order (`CREATED`)
2. Frontend executes `payForService(orderIdHex, serviceIdHex, ...)`
3. Worker observes `OrderPaid`
4. Worker verifies contract/token/amount/addresses and confirmations
5. Worker sets order `PAID`
6. Dispatcher sends task to supplier endpoint and sets `RUNNING`
7. Supplier callback updates order to `COMPLETED` or `FAILED`

### 6.3 Failure Flow

1. Supplier timeout or invalid callback occurs
2. Worker retries once
3. If still failing, order becomes `FAILED` with reason code

## 7. Data and Persistence Blueprint

Tables:
- `services`
- `orders`
- `payment_events`
- `dispatch_jobs` (optional if BullMQ metadata in Redis is not enough for audit)

Must-have indexes:
- `orders(status, created_at)`
- `orders(order_id_hex)`
- `payment_events(tx_hash, log_index)` unique

## 8. Security Blueprint

- Validate all addresses and payload schemas
- Callback authentication with HMAC:
  - `X-Callback-Timestamp`
  - `X-Callback-Nonce`
  - `X-Callback-Signature`
- Replay protection:
  - nonce store with TTL
  - timestamp freshness window (e.g. 5 minutes)
- Never trust client-side status updates

## 9. Observability Blueprint

Metrics:
- `orders_created_total`
- `orders_paid_total`
- `orders_completed_total`
- `orders_failed_total`
- `payment_listener_block_lag`
- `supplier_exec_latency_ms`
- `callback_auth_failed_total`

Log fields:
- `order_id`
- `service_id`
- `order_id_hex`
- `tx_hash`
- `status`
- `error_code`

## 10. Testing Blueprint

Contract tests:
- `OrderPaid` emission correctness
- token and amount behavior

Backend unit tests:
- state machine transitions
- ID mapping determinism
- callback signature verification

Integration tests:
- event ingestion to `PAID`
- dispatch + callback to `COMPLETED`
- timeout path to `FAILED`

E2E tests:
- full flow from web payment to final result

## 11. Deployment Blueprint

Environments:
- `local`: dockerized Postgres/Redis + BSC testnet or mocked chain
- `demo`: cloud-hosted API/worker/web + BSC mainnet proof transaction

Deployment sequence:
1. Deploy `PaymentRouter`
2. Configure env and start `apps/api`
3. Start `apps/worker`
4. Start `apps/web`
5. Run smoke E2E and capture proof artifacts

## 12. OpenClaw Submission Mapping

Mandatory mapping:
- On-chain proof: contract address + tx hash
- Reproducibility: README setup + one-command local run
- Demo evidence: live URL or video
- Compliance: no token launch behavior

Bonus mapping:
- AI Build Log: record where AI accelerated development and where manual verification was performed
