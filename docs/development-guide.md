# Claw Marketplace Development Guide

## 1. Purpose

This document is the execution handbook for building Claw Marketplace from zero to OpenClaw submission using the architecture in `docs/implementation-blueprint.md`.

## 2. Prerequisites

- Node.js `>= 20`
- `pnpm` `>= 9`
- Docker Desktop (for Postgres and Redis)
- Git + GitHub access
- One funded BSC wallet for final proof transaction
- One funded supplier wallet (can be separate from deployer)

## 3. Workspace Bootstrap

### 3.1 Initialize Monorepo

1. Initialize workspace with `pnpm workspaces` and `turbo`.
2. Create app folders: `apps/api`, `apps/worker`, `apps/web`, `apps/supplier-mock`.
3. Create package folders: `packages/shared-types`, `packages/sdk-consumer`, `packages/sdk-supplier`, `packages/config`, `packages/observability`.
4. Create contract folder: `contracts`.

### 3.2 Local Infrastructure

1. Start `PostgreSQL` and `Redis` through `infra/docker-compose.yml`.
2. Create env files from examples (at least `apps/api/.env`).
3. Run Prisma schema sync:
   - `pnpm --filter @agos/api prisma:generate`
   - `pnpm --filter @agos/api prisma:push`
4. Validate connectivity from API and worker.

## 4. Environment Variables

Use separate files per app:
- `apps/api/.env`
- `apps/worker/.env`
- `apps/web/.env`
- `contracts/.env`

Minimum env set:
- `DATABASE_URL`
- `REDIS_URL`
- `RPC_URL`
- `CHAIN_ID=56`
- `USDT_ADDRESS`
- `PAYMENT_ROUTER_ADDRESS`
- `MIN_CONFIRMATIONS=3`
- `CALLBACK_HMAC_SECRET`
- `SUPPLIER_TIMEOUT_MS=30000`
- `DISPATCH_MAX_RETRY=1`

Rule:
- Never commit real secrets.
- Keep `.env.example` files updated whenever env keys change.

## 5. Build Order (Recommended)

Implement in this order to minimize rework:

1. `packages/shared-types`
2. `contracts`
3. `apps/api` (service + order create/query)
4. `apps/worker` (listener + dispatch)
5. `apps/supplier-mock`
6. `apps/web`
7. `packages/sdk-consumer` and `packages/sdk-supplier`
8. Hardening, tests, and submission assets

## 6. Module-Level Definition of Done

### 6.1 Shared Types

- `order_id/service_id` mapping helpers tested
- Order state machine transition guard tested
- DTO schemas reused by API, worker, and SDKs

### 6.2 Contracts

- `PaymentRouter` deploys successfully
- `OrderPaid` emits with expected indexed fields
- ABI exported and consumed by API/worker/web

### 6.3 API

- Service endpoints working with validation
- Order endpoints working with persistence
- `Prisma + PostgreSQL` persistence wired as default store
- Callback endpoint verifies signature and replay guard
- Health endpoint reports DB and listener lag basics

### 6.4 Worker

- Listener consumes `OrderPaid` and updates order to `PAID`
- Idempotent processing for duplicate events
- Dispatch queue transitions `PAID -> RUNNING -> COMPLETED/FAILED`
- Timeout and retry path validated

### 6.5 Web

- Service list loaded from API
- Wallet payment triggers contract call
- Timeline updates from backend state
- Tx proof panel shows explorer link

### 6.6 SDKs

- Consumer helper can create/pay/poll end-to-end
- Supplier helper can sign callback payload correctly

## 7. Coding and Review Rules

- Strict TypeScript (`noImplicitAny`, `strictNullChecks`)
- Runtime validation for all external payloads
- No inline business logic in controllers; use domain services
- Every state transition must be logged with `order_id`
- No silent catch blocks

Review checklist:
- Is the change idempotent under retries?
- Is replay risk addressed?
- Are on-chain/off-chain IDs consistently mapped?
- Is the behavior observable from logs and metrics?

## 8. Testing Plan by Stage

Stage 1:
- Unit tests for shared types and mapping helpers

Stage 2:
- Contract tests for event and value correctness

Stage 3:
- API integration tests for services/orders/callback auth

Stage 4:
- Worker integration tests for event ingestion and dispatch

Stage 5:
- E2E test for full flow using supplier mock

Release gate:
- At least one passing E2E path and one passing failure path before demo recording

## 9. Delivery Milestones (UTC)

Reference schedule aligned with OpenClaw timeline:

1. `2026-02-06` to `2026-02-09`
   - foundation: types, contracts, base API
2. `2026-02-10` to `2026-02-14`
   - closed loop: listener + dispatch + callback
3. `2026-02-15` to `2026-02-17`
   - polish: web timeline, reliability, observability
4. `2026-02-18` to `2026-02-19 15:00`
   - package: docs, proof artifacts, demo recording, final submission

## 10. Daily Standup Template

Use this short template daily:

- Yesterday:
  - completed items
- Today:
  - highest-priority implementation tasks
- Risks:
  - blockers and mitigation owner
- Submission impact:
  - whether proof/reproducibility quality improved

## 11. Demo Day Runbook

1. Start infrastructure, API, worker, supplier mock, web
2. Verify health endpoints
3. Register supplier service
4. Create order from web
5. Execute payment transaction on BSC
6. Watch timeline from `CREATED` to `COMPLETED`
7. Capture tx hash and explorer proof
8. Export logs for the demonstrated order

Fallback:
- If live supplier endpoint fails, switch to supplier mock and replay with a fresh order.

## 12. OpenClaw Submission Checklist

- [ ] Public repo is accessible
- [ ] README has reproducible setup instructions
- [ ] Demo URL or video is ready
- [ ] At least one successful BSC tx proof is included
- [ ] Contract address is included
- [ ] No token launch/fundraising actions in project
- [ ] AI Build Log is attached

## 13. AI Build Log Template

Use this structure in your final submission:

1. Prompt/intent
2. AI-assisted output
3. Human verification performed
4. Final adopted change
5. Risks found and fixes applied

## 14. Handover Package

Before final submit, prepare:
- release commit hash
- environment matrix
- runbook link
- proof artifact links
- known limitations and post-hackathon roadmap
