import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from './app.js';
import { InMemoryStore } from './store.js';

const servicePayload = {
  service_id: 'svc_demo_v1',
  name: 'Demo Service',
  description: 'Demo',
  input_schema: { type: 'object' },
  output_schema: { type: 'object' },
  price_usdt: '1.0',
  endpoint: 'http://localhost:3003/task',
  supplier_wallet: '0x0000000000000000000000000000000000000001',
  version: '1.0.0',
  is_active: true
};

describe('api app', () => {
  const app = buildApp({ store: new InMemoryStore() });

  beforeEach(async () => {
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('registers service and creates order', async () => {
    const serviceRes = await app.inject({
      method: 'POST',
      url: '/v1/services',
      payload: servicePayload
    });

    expect(serviceRes.statusCode).toBe(201);

    const orderRes = await app.inject({
      method: 'POST',
      url: '/v1/orders',
      payload: {
        service_id: servicePayload.service_id,
        buyer_wallet: '0x0000000000000000000000000000000000000002',
        input_payload: { query: 'hello' }
      }
    });

    expect(orderRes.statusCode).toBe(201);
    const order = orderRes.json();
    expect(order.status).toBe('CREATED');
  });

  it('records payment event idempotently and supports order lookup by hex', async () => {
    await app.inject({
      method: 'POST',
      url: '/v1/services',
      payload: servicePayload
    });

    const orderRes = await app.inject({
      method: 'POST',
      url: '/v1/orders',
      payload: {
        service_id: servicePayload.service_id,
        buyer_wallet: '0x0000000000000000000000000000000000000002',
        input_payload: { query: 'pay' }
      }
    });
    const created = orderRes.json();

    const byHexRes = await app.inject({
      method: 'GET',
      url: `/v1/orders/by-hex/${created.order_id_hex}`
    });
    expect(byHexRes.statusCode).toBe(200);
    expect(byHexRes.json().order_id).toBe(created.order_id);

    const firstPaymentRes = await app.inject({
      method: 'POST',
      url: `/v1/internal/orders/${created.order_id}/payment-event`,
      headers: {
        'x-internal-secret': 'dev-secret'
      },
      payload: {
        order_id_hex: created.order_id_hex,
        tx_hash: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        block_number: 123,
        log_index: 0,
        raw_event: {
          source: 'test'
        }
      }
    });
    expect(firstPaymentRes.statusCode).toBe(200);
    const firstApplied = firstPaymentRes.json();
    expect(firstApplied.transitioned_to_paid).toBe(true);
    expect(firstApplied.duplicate_event).toBe(false);
    expect(firstApplied.order.status).toBe('PAID');

    const duplicatePaymentRes = await app.inject({
      method: 'POST',
      url: `/v1/internal/orders/${created.order_id}/payment-event`,
      headers: {
        'x-internal-secret': 'dev-secret'
      },
      payload: {
        order_id_hex: created.order_id_hex,
        tx_hash: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        block_number: 123,
        log_index: 0,
        raw_event: {
          source: 'test'
        }
      }
    });
    expect(duplicatePaymentRes.statusCode).toBe(200);
    const duplicateApplied = duplicatePaymentRes.json();
    expect(duplicateApplied.transitioned_to_paid).toBe(false);
    expect(duplicateApplied.duplicate_event).toBe(true);
    expect(duplicateApplied.order.status).toBe('PAID');
  });
});
