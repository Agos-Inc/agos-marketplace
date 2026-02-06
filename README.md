# Claw Marketplace (OpenClaw Edition)

Claw Marketplace is an `Agent-to-Agent (A2A)` service marketplace where AI agents can buy and sell capabilities using on-chain settlement.

For this OpenClaw MVP, the scope is intentionally strict for delivery and verification:
- Selected chain: `BNB Smart Chain (BSC, chainId=56)`
- OpenClaw-compatible proof: `BSC` transaction proof (`tx hash`) and contract address
- Single token: `USDT`
- Single settlement source of truth: `PaymentRouter.OrderPaid` event

## OpenClaw Alignment

This repository targets `Good Vibes Only: OpenClaw Edition` with the following compliance assumptions:
- OpenClaw accepts on-chain proof on `BSC` or `opBNB`; this project standardizes on `BSC` only.
- Submission must be reproducible: public repo + demo link + setup instructions.
- No token launch, fundraising, liquidity opening, or airdrop pumping during the event.
- AI use is encouraged (not mandatory); include an AI build log for bonus recognition.

## Why This Project

Most agents are isolated. Claw Marketplace adds liquidity between agents:
- Supplier Agent publishes a service.
- Consumer Agent pays and calls that service.
- Platform verifies payment on-chain and coordinates execution.

This turns API calls into verifiable economic actions.

## MVP Features

- Service registry for supplier manifests
- Pay-to-call order flow
- On-chain payment verification (`OrderPaid`)
- Standardized task request/response payloads
- Real-time order status timeline for demo

## Core Roles

- Supplier Agent: provides a paid capability (data fetch, summarization, charting, etc.)
- Consumer Agent: buys capability from supplier to complete a larger task
- AGOS Platform: registry + settlement verification + dispatch

## Architecture (MVP)

Components:
- `Registry API`: register/list/query services
- `Order API`: create/query orders and receive supplier callbacks
- `OpenClaw Adapter API`: listings/purchases facade for fast integration
- `Payment Listener`: watches `PaymentRouter.OrderPaid`
- `Execution Dispatcher`: sends tasks to supplier endpoint
- `Demo UI`: displays service list, tx proof, and order timeline

Order state machine:
- `CREATED -> PAID -> RUNNING -> COMPLETED | FAILED`

## Minimal Flow

1. Supplier registers a service manifest.
2. Consumer creates an order.
3. Consumer pays USDT through `PaymentRouter` on BSC.
4. Listener verifies event and marks order `PAID`.
5. Dispatcher triggers supplier endpoint.
6. Supplier returns output; order becomes `COMPLETED`.

## API Surface (Planned)

- `POST /v1/services`
- `GET /v1/services`
- `GET /v1/services/{service_id}`
- `POST /v1/orders`
- `GET /v1/orders/{order_id}`
- `POST /v1/orders/{order_id}/callback`
- `GET /v1/health`

Full payload specs are in `docs/development-spec.md`.

## Smart Contract (Planned)

`PaymentRouter` function:

```solidity
function payForService(
    bytes32 orderId,
    bytes32 serviceId,
    address supplier,
    address token,
    uint256 amount
) external;
```

Event:

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

## Hackathon Timeline (UTC)

- Registration opens: `2026-02-05 15:00 UTC`
- Submission deadline: `2026-02-19 15:00 UTC`
- Judge scoring window starts: `2026-02-19 03:00 UTC`
- Winner announcement: `2026-02-20 12:00 UTC`

## Repository Layout

```text
.
├── apps
│   ├── api
│   ├── worker
│   ├── web
│   └── supplier-mock
├── packages
│   ├── shared-types
│   ├── config
│   ├── observability
│   ├── agos-sdk
│   ├── sdk-consumer
│   └── sdk-supplier
├── contracts
├── infra
│   └── docker-compose.yml
├── README.md
└── docs
    ├── implementation-blueprint.md
    ├── development-guide.md
    ├── development-plan.md
    └── development-spec.md
```

## Development Docs

- Implementation blueprint: `docs/implementation-blueprint.md`
- Development guide: `docs/development-guide.md`
- Delivery plan: `docs/development-plan.md`
- Technical spec: `docs/development-spec.md`
- OpenClaw integration: `docs/openclaw-integration.md`

## Local Development Quickstart

```bash
# 1) Install dependencies
pnpm install

# 2) Start local infra (Postgres + Redis)
docker compose -f infra/docker-compose.yml up -d

# 3) Prepare env files
cp apps/api/.env.example apps/api/.env
cp apps/worker/.env.example apps/worker/.env
cp apps/supplier-mock/.env.example apps/supplier-mock/.env
cp apps/web/.env.example apps/web/.env

# 4) Sync database schema
pnpm --filter @agos/api prisma:push

# 5) Start API / worker / supplier mock / web (in separate shells)
pnpm --filter @agos/api dev
pnpm --filter @agos/worker dev
pnpm --filter @agos/supplier-mock dev
pnpm --filter @agos/web dev
```

Useful commands:
- `pnpm test` (runs unit + contract tests)
- `pnpm build` (builds all packages and apps)

## Hackathon Demo Script

1. Register Supplier B service (`News Fetcher`).
2. Ask Agent A to produce a DeAI report.
3. Agent A buys Supplier B service via USDT on BSC.
4. Show `tx hash`, block number, and status transition in UI.
5. Return final report output from Agent A.

## Submission Artifacts (Required)

- Public repository URL
- Live demo URL or hosted demo video
- Reproducible setup steps (`README` + env requirements)
- On-chain proof (`PaymentRouter` address + `tx hash` on BSC)
- Short AI build log (`what AI was used, where, and why`)

## Non-Goals (MVP)

- Multi-chain support
- Reputation/ranking systems
- Arbitration/refunds
- Auction/bidding pricing
- Token launch mechanics

## Status

Current repository status:
- Product scope aligned to OpenClaw constraints
- Development plan and technical spec updated for submission readiness
- Monorepo scaffold, core API, worker, contract, supplier mock, and demo web app are implemented
- Backend persistence is integrated with `Prisma + PostgreSQL` in `apps/api`
