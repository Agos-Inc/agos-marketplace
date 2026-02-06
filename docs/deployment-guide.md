# AGOS Marketplace Deployment Guide

This guide explains how to deploy the current AGOS Marketplace stack:
- Local demo deployment (recommended first)
- Production-style split deployment (`api` / `worker` / `web`)

Current scope:
- Chain: `BNB Smart Chain (chainId=56)`
- Settlement: `USDT + PaymentRouter.OrderPaid`
- Backend: `Fastify + Prisma + PostgreSQL`
- Worker: `BullMQ + Redis + viem`

## 1. Prerequisites

Required:
- Node.js `>=20`
- pnpm `>=9`
- Docker (for PostgreSQL / Redis)
- A reachable BSC RPC endpoint

Clone and install:

```bash
git clone git@github.com:Agos-Inc/agos-marketplace.git
cd agos-marketplace
pnpm install
```

## 2. Local Deployment (Recommended)

### 2.1 Start infrastructure

```bash
docker compose -f infra/docker-compose.yml up -d
```

If port `6379` is already in use, start PostgreSQL only:

```bash
docker compose -f infra/docker-compose.yml up -d postgres
```

### 2.2 Configure environment variables

```bash
cp apps/api/.env.example apps/api/.env
cp apps/worker/.env.example apps/worker/.env
cp apps/supplier-mock/.env.example apps/supplier-mock/.env
cp apps/web/.env.example apps/web/.env
```

At minimum verify:

- `apps/api/.env`
  - `DATABASE_URL`
  - `CHAIN_ID=56`
  - `USDT_ADDRESS`
  - `PAYMENT_ROUTER_ADDRESS`
  - `CALLBACK_HMAC_SECRET`
- `apps/worker/.env`
  - `API_BASE_URL`
  - `RPC_URL`
  - `USDT_ADDRESS`
  - `PAYMENT_ROUTER_ADDRESS`
  - `CALLBACK_HMAC_SECRET`

### 2.3 Sync Prisma schema

```bash
pnpm --filter @agos/api prisma:generate
pnpm --filter @agos/api prisma:push
```

### 2.4 Start services

Run in separate terminals:

```bash
pnpm --filter @agos/api dev
pnpm --filter @agos/worker dev
pnpm --filter @agos/supplier-mock dev
pnpm --filter @agos/web dev
```

Default endpoints:
- API: `http://localhost:3000`
- Web: `http://localhost:3002` (confirm from Next.js output)
- Supplier Mock: `http://localhost:3003`

### 2.5 Post-deploy checks

```bash
pnpm typecheck
pnpm test
pnpm build
```

Health check:

```bash
curl http://localhost:3000/v1/health
```

`db` should be `postgres`.

## 3. Production Deployment Recommendation

Deploy these apps independently:
- `apps/api`: stateless API (PostgreSQL-backed)
- `apps/worker`: long-running processor (Redis + API + RPC)
- `apps/web`: Next.js frontend
- `apps/supplier-mock`: demo-only environment

Infrastructure recommendation:
- PostgreSQL: managed service (Neon / Supabase / RDS)
- Redis: managed service (Upstash / Redis Cloud)
- Logging: centralized stack (Datadog / Loki / ELK)

## 4. Production Environment Variables

Minimum set:

- API
  - `NODE_ENV=production`
  - `PORT`
  - `DATABASE_URL`
  - `CHAIN_ID=56`
  - `RPC_URL`
  - `USDT_ADDRESS`
  - `PAYMENT_ROUTER_ADDRESS`
  - `CALLBACK_HMAC_SECRET`
- Worker
  - `NODE_ENV=production`
  - `API_BASE_URL`
  - `REDIS_URL`
  - `RPC_URL`
  - `USDT_ADDRESS`
  - `PAYMENT_ROUTER_ADDRESS`
  - `CALLBACK_HMAC_SECRET`
  - `SUPPLIER_TIMEOUT_MS`
  - `DISPATCH_MAX_RETRY`
- Web
  - `NEXT_PUBLIC_API_BASE_URL`
  - Optional for wallet integration: `NEXT_PUBLIC_CHAIN_ID`, `NEXT_PUBLIC_RPC_URL`

## 5. Troubleshooting

### Q1: `prisma db push` fails with `DATABASE_URL not found`

Load `apps/api/.env` first, or inject directly:

```bash
DATABASE_URL='postgresql://postgres:postgres@localhost:5432/agos?schema=public' pnpm --filter @agos/api prisma:push
```

### Q2: Worker is not receiving events

Check:
- `PAYMENT_ROUTER_ADDRESS` is correct
- `USDT_ADDRESS` is correct
- `RPC_URL` is stable
- You are sending transactions on `chainId=56`

### Q3: Order stays at `PAID`

Check:
- `apps/worker` process is running
- Supplier endpoint is reachable
- `CALLBACK_HMAC_SECRET` is the same in API and Supplier

## 6. Release Procedure (Recommended)

1. Merge and tag the release
2. Run `pnpm test && pnpm build`
3. Deploy API
4. Deploy Worker
5. Deploy Web
6. Run one end-to-end order and verify `CREATED -> PAID -> RUNNING -> COMPLETED`
