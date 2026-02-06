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
});
