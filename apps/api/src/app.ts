import { timingSafeEqual } from 'node:crypto';
import Fastify from 'fastify';
import type { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import { z } from 'zod';
import { loadEnv, type AppEnv } from '@agos/config';
import { logger, recordMetric } from '@agos/observability';
import {
  callbackHeadersSchema,
  idToHex,
  orderCallbackSchema,
  ORDER_STATES,
  type Order,
  type OrderState,
  priceToAtomic,
  type ServiceManifest
} from '@agos/shared-types';
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

const internalPaymentEventSchema = z.object({
  order_id_hex: z.string().regex(/^0x[a-fA-F0-9]{64}$/),
  tx_hash: z.string().regex(/^0x[a-fA-F0-9]{64}$/),
  block_number: z.number().int().nonnegative(),
  log_index: z.number().int().nonnegative(),
  raw_event: z.record(z.string(), z.unknown())
});

const openClawCreatePurchaseSchema = z.object({
  listing_id: z.string().min(3),
  buyer_wallet: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  input_payload: z.record(z.string(), z.unknown())
});

type OpenClawListing = {
  listing_id: string;
  listing_id_hex: string;
  title: string;
  description: string;
  price_usdt: string;
  price_atomic: string;
  token_decimals: number;
  supplier_wallet: string;
  endpoint: string;
  version: string;
  is_active: boolean;
};

type OpenClawPurchase = {
  purchase_id: string;
  purchase_id_hex: string;
  listing_id: string;
  listing_id_hex: string;
  buyer_wallet: string;
  supplier_wallet: string;
  amount_usdt: string;
  amount_atomic: string;
  token_decimals: number;
  token_address: string;
  chain_id: number;
  status: OrderState;
  tx_hash: string | null;
  error_message: string | null;
  result_payload: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
};

function toOpenClawListing(service: ServiceManifest): OpenClawListing {
  return {
    listing_id: service.service_id,
    listing_id_hex: service.service_id_hex ?? idToHex(service.service_id),
    title: service.name,
    description: service.description,
    price_usdt: service.price_usdt,
    price_atomic: service.price_atomic ?? priceToAtomic(service.price_usdt, service.token_decimals).toString(),
    token_decimals: service.token_decimals,
    supplier_wallet: service.supplier_wallet,
    endpoint: service.endpoint,
    version: service.version,
    is_active: service.is_active
  };
}

function toOpenClawPurchase(order: Order): OpenClawPurchase {
  return {
    purchase_id: order.order_id,
    purchase_id_hex: order.order_id_hex,
    listing_id: order.service_id,
    listing_id_hex: order.service_id_hex,
    buyer_wallet: order.buyer_wallet,
    supplier_wallet: order.supplier_wallet,
    amount_usdt: order.amount_usdt,
    amount_atomic: order.amount_atomic,
    token_decimals: order.token_decimals,
    token_address: order.token_address,
    chain_id: order.chain_id,
    status: order.status,
    tx_hash: order.tx_hash,
    error_message: order.error_message,
    result_payload: order.result_payload,
    created_at: order.created_at,
    updated_at: order.updated_at
  };
}

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

  app.get('/v1/openclaw/listings', async () => {
    const services = await store.listServices();
    return services.map(toOpenClawListing);
  });

  app.get('/v1/openclaw/listings/:listing_id', async (request, reply) => {
    const params = request.params as { listing_id: string };
    const service = await store.getService(params.listing_id);

    if (!service) {
      return reply.code(404).send({ message: 'listing not found' });
    }

    return toOpenClawListing(service);
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

  app.post('/v1/openclaw/purchases', async (request, reply) => {
    try {
      const payload = openClawCreatePurchaseSchema.parse(request.body);
      const order = await store.createOrder(
        {
          service_id: payload.listing_id,
          buyer_wallet: payload.buyer_wallet,
          input_payload: payload.input_payload
        },
        env.USDT_ADDRESS,
        env.CHAIN_ID
      );
      recordMetric({ name: 'orders_created_total', value: 1 });
      return reply.code(201).send(toOpenClawPurchase(order));
    } catch (error) {
      return reply.code(400).send({ message: (error as Error).message });
    }
  });

  app.get('/v1/openclaw/purchases/:purchase_id', async (request, reply) => {
    const params = request.params as { purchase_id: string };
    const order = await store.getOrder(params.purchase_id);
    if (!order) {
      return reply.code(404).send({ message: 'purchase not found' });
    }
    return toOpenClawPurchase(order);
  });

  app.get('/v1/openclaw/purchases/by-hex/:order_id_hex', async (request, reply) => {
    const params = request.params as { order_id_hex: string };
    const order = await store.getOrderByHex(params.order_id_hex);
    if (!order) {
      return reply.code(404).send({ message: 'purchase not found' });
    }
    return toOpenClawPurchase(order);
  });

  app.post('/v1/openclaw/purchases/:purchase_id/prepare-payment', async (request, reply) => {
    const params = request.params as { purchase_id: string };
    const order = await store.getOrder(params.purchase_id);

    if (!order) {
      return reply.code(404).send({ message: 'purchase not found' });
    }

    return {
      purchase_id: order.order_id,
      purchase_id_hex: order.order_id_hex,
      listing_id: order.service_id,
      listing_id_hex: order.service_id_hex,
      chain_id: order.chain_id,
      token_address: order.token_address,
      payment_router_address: env.PAYMENT_ROUTER_ADDRESS,
      amount_atomic: order.amount_atomic,
      supplier_wallet: order.supplier_wallet
    };
  });

  app.get('/v1/orders/by-hex/:order_id_hex', async (request, reply) => {
    const params = request.params as { order_id_hex: string };
    const order = await store.getOrderByHex(params.order_id_hex);

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

  app.post('/v1/internal/orders/:order_id/payment-event', async (request, reply) => {
    const internalSecret = request.headers['x-internal-secret'];
    if (internalSecret !== env.CALLBACK_HMAC_SECRET) {
      return reply.code(401).send({ message: 'unauthorized internal request' });
    }

    const params = request.params as { order_id: string };

    try {
      const payload = internalPaymentEventSchema.parse(request.body);
      const applied = await store.recordPaymentEvent(params.order_id, payload);
      if (applied.transitioned_to_paid) {
        recordMetric({ name: 'orders_paid_total', value: 1 });
      }
      return applied;
    } catch (error) {
      return reply.code(400).send({ message: (error as Error).message });
    }
  });

  return app;
}
