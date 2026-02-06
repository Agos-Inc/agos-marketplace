# Claw Marketplace MVP Development Plan (OpenClaw, BSC-only)

## 1. Scope and Goal

### Goal
Build a hackathon-ready closed loop for `Agent-to-Agent` service purchase:

1. Supplier registers a service.
2. Consumer discovers the service and pays in `USDT` on `BSC`.
3. Platform verifies on-chain payment event.
4. Supplier executes task and returns result.
5. UI shows real-time transaction and order status.

### OpenClaw Submission Constraints

- On-chain proof required: contract address or `tx hash`.
- Target chain policy: OpenClaw supports `BSC` or `opBNB`; this project locks to `BSC` only.
- Submission must be reproducible: public repo + demo + setup instructions.
- No token launch behavior during event window.
- AI usage is optional, but AI build log is recommended.

### Fixed Scope (MVP)

- Single chain: `BSC (chainId=56)`.
- Single token: `USDT`.
- Single settlement path: `PaymentRouter` event as the only payment proof.
- Single order flow: `CREATED -> PAID -> RUNNING -> COMPLETED | FAILED`.

### Out of Scope (Post-MVP)

- Arbitration and refunds.
- Rating/reputation system.
- Multi-chain support.
- Bidding/auction pricing.
- Complex recommendation/ranking.

## 2. Workstream Breakdown

### WS0 Submission Compliance and Evidence

- Prepare a deterministic demo scenario and runbook.
- Produce reproducibility instructions (env, run steps, expected outputs).
- Capture on-chain proof package (`contract`, `tx hash`, explorer links).
- Prepare AI build log summary for submission package.

Deliverable:
- Complete submission checklist and artifact bundle.

### WS1 Smart Contract and On-Chain Verification

- Define `PaymentRouter` contract interface and event.
- Implement `payForService(...)` using `transferFrom`.
- Emit canonical `OrderPaid` event with `orderId` and `serviceId`.
- Add tests for event emission and value correctness.

Deliverable:
- Contract ABI and deployed address.
- Verified event schema used by backend.

### WS2 Backend Core (Registry + Order + Verification + Execution)

- Implement service registry CRUD (register/list/get).
- Implement order creation API (off-chain order metadata).
- Implement chain listener for `OrderPaid` event and confirmation policy.
- Implement task dispatch to supplier endpoint with idempotency lock.
- Implement order status update and callback handling.

Deliverable:
- Backend API for registry/order/status.
- Worker/listener process for chain event ingestion.

### WS3 Supplier/Consumer SDK (Minimal)

- Consumer helper: create order, build tx, submit payment, poll status.
- Supplier helper: validate task payload, return output schema.
- Typed manifest and payload validator.

Deliverable:
- Minimal SDK package or local library used by demo agents.

### WS4 Demo UI and Storyline

- Service marketplace page (list/select service).
- Payment action + wallet confirmation.
- Real-time timeline: `created -> paid -> running -> completed`.
- Tx hash, block number, and explorer link display.

Deliverable:
- End-to-end demo with scripted `Agent A hires Agent B`.

## 3. Milestones and Timeline (UTC)

### Phase 1: Foundation (`2026-02-06` to `2026-02-09`)

- Freeze API/event schema and ID mapping rules.
- Implement and deploy `PaymentRouter`.
- Build backend skeleton and DB tables.
- Add service registration endpoint.

Exit Criteria:
- Able to register service and read it from API.
- Able to emit `OrderPaid` with deterministic fields.

### Phase 2: Closed Loop (`2026-02-10` to `2026-02-14`)

- Create order API and status persistence.
- Implement payment listener and update to `PAID`.
- Implement supplier dispatch and callback path.
- Produce first full success case via CLI.

Exit Criteria:
- One full flow completes without manual DB edits.
- Order status transitions are consistent and observable.

### Phase 3: Reliability and Demo Polish (`2026-02-15` to `2026-02-17`)

- Add UI timeline and tx visualization.
- Add retry/idempotency/error handling.
- Add fallback replay script.
- Run repeated smoke tests.

Exit Criteria:
- Stable repeated demo runs.
- Critical logs and metrics visible.

### Phase 4: Submission Package (`2026-02-18` to `2026-02-19 15:00`)

- Finalize public README and reproducibility steps.
- Finalize on-chain proof references.
- Prepare demo recording and AI build log.
- Submit before deadline.

Exit Criteria:
- All OpenClaw mandatory artifacts are complete.

## 4. Task Board (Implementation Checklist)

- [ ] Define shared types: `ServiceManifest`, `Order`, `PaymentProof`, `TaskRequest`, `TaskResponse`.
- [ ] Define deterministic mapping: `order_id/service_id -> bytes32`.
- [ ] Create DB schema and migration.
- [ ] Build service registry APIs.
- [ ] Build order APIs.
- [ ] Deploy and configure `PaymentRouter`.
- [ ] Build chain listener worker.
- [ ] Build execution dispatcher worker.
- [ ] Build minimal supplier and consumer SDK helpers.
- [ ] Build demo UI timeline and tx panel.
- [ ] Add integration test for full flow.
- [ ] Prepare demo script and failover script.
- [ ] Prepare submission artifact bundle.
- [ ] Prepare AI build log summary.

## 5. Roles and Ownership (Suggested)

- `Contract Owner`: PaymentRouter, ABI, deployment, event consistency.
- `Backend Owner`: API, DB, listener, dispatcher, idempotency.
- `Agent/SDK Owner`: supplier and consumer integration helpers.
- `Frontend Owner`: marketplace page and transaction timeline.
- `Demo Owner`: storytelling, runbook, and fallback handling.
- `Submission Owner`: compliance checklist and final package.

## 6. Acceptance Criteria (Hackathon DoD)

1. A supplier service can be registered and discovered.
2. Consumer payment on BSC USDT is captured as an `OrderPaid` event.
3. Backend verifies payment and starts supplier execution automatically.
4. Consumer receives structured result linked to the same `orderId`.
5. UI shows transaction proof and status transitions in real time.
6. Submission is reproducible from README instructions.
7. On-chain proof and contract references are included in submission.
8. No token launch mechanics are included in the delivery.

## 7. Risk and Mitigation

- Wallet/network instability:
  - Mitigation: pre-fund demo wallet, pre-approve USDT allowance, keep backup RPC.
- Event delay or missed logs:
  - Mitigation: block range backfill + idempotent event processing.
- Supplier timeout:
  - Mitigation: strict timeout + retry once + mark `FAILED` with reason.
- Submission disqualification due to missing artifacts:
  - Mitigation: maintain artifact checklist and dry-run submission packaging.
- Demo dependency failure:
  - Mitigation: keep pre-recorded tx/order sample for deterministic fallback.

## 8. Demo Runbook (Short)

1. Start backend API + listener + dispatcher.
2. Register Supplier B service.
3. Submit request from Consumer/Agent A.
4. Confirm wallet tx on BSC USDT.
5. Show on-screen tx proof and status progression.
6. Display final generated report/summary result.

## 9. Submission Package Checklist

- [ ] Public repo URL
- [ ] Demo URL or demo video
- [ ] Setup instructions + env requirements
- [ ] Contract address + tx hash proof
- [ ] AI build log summary
- [ ] Final presentation summary (problem, solution, proof, impact)
