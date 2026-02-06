# AGOS Marketplace Usage Guide

This guide explains how to run a complete purchase flow end-to-end for demos and integration testing.

## 1. Roles

- Supplier: registers a service and returns callback results
- Consumer: creates an order and pays on-chain
- Platform: verifies payment and dispatches execution

Order lifecycle:
- `CREATED -> PAID -> RUNNING -> COMPLETED | FAILED`

## 2. Start the System

Follow `/Volumes/970EVO/agos-marketplace/docs/deployment-guide.md` first, then verify:

- API: `GET /v1/health`
- Worker logs include `worker started` and `order paid listener started`
- Supplier Mock: `/health` is reachable
- Web app is accessible

## 3. Complete Flow via API

### 3.1 Register a service (Supplier)

```bash
curl -X POST http://localhost:3000/v1/services \
  -H 'content-type: application/json' \
  -d '{
    "service_id":"svc_demo_v1",
    "name":"Demo Service",
    "description":"Demo",
    "input_schema":{"type":"object"},
    "output_schema":{"type":"object"},
    "price_usdt":"1.0",
    "endpoint":"http://localhost:3003/task",
    "supplier_wallet":"0x0000000000000000000000000000000000000001",
    "version":"1.0.0",
    "is_active":true
  }'
```

### 3.2 Create an order (Consumer)

```bash
curl -X POST http://localhost:3000/v1/orders \
  -H 'content-type: application/json' \
  -d '{
    "service_id":"svc_demo_v1",
    "buyer_wallet":"0x0000000000000000000000000000000000000002",
    "input_payload":{"query":"hello"}
  }'
```

Record these fields from the response:
- `order_id`
- `order_id_hex`
- `service_id_hex`
- `amount_atomic`

### 3.3 Pay on-chain

Payment confirmation is based on `PaymentRouter.OrderPaid`.
Call the contract function:

- `payForService(orderId, serviceId, supplier, token, amount)`

Mapping:
- `orderId` = `order_id_hex`
- `serviceId` = `service_id_hex`
- `supplier` = service `supplier_wallet`
- `token` = `USDT_ADDRESS`
- `amount` = `amount_atomic`

After success, the Worker validates event fields and sets the order to `PAID`.

### 3.4 Query order status

```bash
curl http://localhost:3000/v1/orders/<order_id>
```

You can also query by hex (useful for chain-level lookup):

```bash
curl http://localhost:3000/v1/orders/by-hex/<order_id_hex>
```

### 3.5 Expected outcome

On success:
1. `CREATED -> PAID`
2. Worker dispatches to supplier, then `RUNNING`
3. Supplier callback succeeds, then `COMPLETED`

On failure:
- Timeout or supplier error leads to `FAILED`

## 4. Demo Through Web UI

In the current Web panel you can:
1. View services
2. Create orders
3. Query order status
4. Observe state changes after on-chain payment

Note: current web is a developer demo panel. Full wallet pay UX can be improved later.

## 5. Internal Endpoints (Worker Only)

Do not expose these endpoints publicly:

- `POST /v1/internal/orders/:order_id/transition`
- `POST /v1/internal/orders/:order_id/payment-event`

Authentication:
- Header `x-internal-secret` must equal `CALLBACK_HMAC_SECRET`

`payment-event` is idempotent:
- Duplicate `(tx_hash, log_index)` events are ignored for repeated state transition.

## 6. Troubleshooting

### 6.1 Order stays `CREATED`

Check:
- `OrderPaid` event was emitted
- Worker is running
- Event fields `token/buyer/supplier/amount/serviceId` match the order

### 6.2 Order stays `PAID`

Check:
- Supplier endpoint is reachable
- Worker can access API and Supplier
- Redis is healthy (BullMQ dependency)

### 6.3 Callback authentication failure

Check:
- `CALLBACK_HMAC_SECRET` is identical in API and Supplier
- Callback signature headers are complete

## 7. Recommended Hackathon Demo Script

1. Register a `News Fetcher` service
2. Create an order
3. Send a real BSC payment transaction
4. Show tx hash and state transitions
5. Show final `COMPLETED` result payload
