import { timingSafeEqual } from 'node:crypto';
import Fastify from 'fastify';
import type { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import { loadEnv, type AppEnv } from '@agos/config';
import { logger, recordMetric } from '@agos/observability';
import { callbackHeadersSchema, orderCallbackSchema, ORDER_STATES, type OrderState } from '@agos/shared-types';
import { InMemoryStore, PrismaStore, signCallback, type InternalTransitionInput, type Store } from './store.js';
import { prisma } from './prisma.js';

function safeEqual(a: string, b: string): boolean {
  const aBuf = Buffer.from(a, 'utf8');
  const bBuf = Buffer.from(b, 'utf8');
  if (aBuf.length !== bBuf.length) {
    return false;
  }
  return timingSafeEqual(aBuf, bBuf);
}

function parseOrderState(input: unknown): OrderState {
  if (typeof input !== 'string' || !ORDER_STATES.includes(input as OrderState)) {
    throw new Error('invalid order state');
  }
  return input as OrderState;
}

export type BuildAppOptions = {
  env?: AppEnv;
  store?: Store;
};

function createDefaultStore(): Store {
  if (process.env.NODE_ENV === 'test') {
    return new InMemoryStore();
  }
  return new PrismaStore(prisma);
}

export function buildApp(options: BuildAppOptions = {}): FastifyInstance<any, any, any, any, any> {
  const env = options.env ?? loadEnv();
  const store = options.store ?? createDefaultStore();
  const app = Fastify({ loggerInstance: logger });

  app.register(cors, { origin: true });
  app.addHook('onClose', async () => {
    await store.close?.();
  });

  app.get('/v1/health', async () => ({
    ok: true,
    db: store.provider,
    chain_listener_lag: null,
    timestamp: new Date().toISOString()
  }));

  app.post('/v1/services', async (request, reply) => {
    try {
      const service = await store.registerService(request.body);
      return reply.code(201).send(service);
    } catch (error) {
      return reply.code(400).send({ message: (error as Error).message });
    }
  });

  app.get('/v1/services', async () => store.listServices());

  app.get('/v1/services/:service_id', async (request, reply) => {
    const params = request.params as { service_id: string };
    const service = await store.getService(params.service_id);
    if (!service) {
      return reply.code(404).send({ message: 'service not found' });
    }
    return service;
  });

  app.post('/v1/orders', async (request, reply) => {
    try {
      const order = await store.createOrder(request.body, env.USDT_ADDRESS, env.CHAIN_ID);
      recordMetric({ name: 'orders_created_total', value: 1 });
      return reply.code(201).send(order);
    } catch (error) {
      return reply.code(400).send({ message: (error as Error).message });
    }
  });

  app.get('/v1/orders', async (request, reply) => {
    try {
      const query = request.query as { status?: string };
      const status = query.status ? parseOrderState(query.status) : undefined;
      return await store.listOrders(status);
    } catch (error) {
      return reply.code(400).send({ message: (error as Error).message });
    }
  });

  app.get('/v1/orders/:order_id', async (request, reply) => {
    const params = request.params as { order_id: string };
    const order = await store.getOrder(params.order_id);

    if (!order) {
      return reply.code(404).send({ message: 'order not found' });
    }

    return order;
  });

  app.post('/v1/orders/:order_id/callback', async (request, reply) => {
    const params = request.params as { order_id: string };

    try {
      const headers = callbackHeadersSchema.parse({
        'x-callback-timestamp': request.headers['x-callback-timestamp'],
        'x-callback-nonce': request.headers['x-callback-nonce'],
        'x-callback-signature': request.headers['x-callback-signature']
      });

      if (!(await store.verifyAndConsumeNonce(headers['x-callback-nonce']))) {
        recordMetric({ name: 'callback_auth_failed_total', value: 1 });
        return reply.code(409).send({ message: 'callback nonce replay detected' });
      }

      const bodyText = JSON.stringify(request.body ?? {});
      const expected = signCallback(
        bodyText,
        headers['x-callback-timestamp'],
        headers['x-callback-nonce'],
        env.CALLBACK_HMAC_SECRET
      );

      if (!safeEqual(expected, headers['x-callback-signature'])) {
        recordMetric({ name: 'callback_auth_failed_total', value: 1 });
        return reply.code(401).send({ message: 'invalid callback signature' });
      }

      const callback = orderCallbackSchema.parse(request.body);
      const order = await store.applySupplierCallback(params.order_id, callback);
      recordMetric({ name: order.status === 'COMPLETED' ? 'orders_completed_total' : 'orders_failed_total', value: 1 });
      return order;
    } catch (error) {
      return reply.code(400).send({ message: (error as Error).message });
    }
  });

  app.post('/v1/internal/orders/:order_id/transition', async (request, reply) => {
    const internalSecret = request.headers['x-internal-secret'];
    if (internalSecret !== env.CALLBACK_HMAC_SECRET) {
      return reply.code(401).send({ message: 'unauthorized internal request' });
    }

    const params = request.params as { order_id: string };
    const body = request.body as InternalTransitionInput;

    try {
      const metadata = {
        ...(body.tx_hash ? { tx_hash: body.tx_hash } : {}),
        ...(body.error_message ? { error_message: body.error_message } : {})
      };
      const next = await store.transitionOrder(params.order_id, parseOrderState(body.to), metadata);

      if (next.status === 'PAID') {
        recordMetric({ name: 'orders_paid_total', value: 1 });
      }

      return next;
    } catch (error) {
      return reply.code(400).send({ message: (error as Error).message });
    }
  });

  return app;
}
