import { Queue, Worker } from 'bullmq';
import { Redis } from 'ioredis';
import { createPublicClient, http } from 'viem';
import { bsc } from 'viem/chains';
import { loadEnv } from '@agos/config';
import { logger, recordMetric } from '@agos/observability';
import type { Order, ServiceManifest } from '@agos/shared-types';

const env = loadEnv();
const apiBase = process.env.API_BASE_URL ?? 'http://localhost:3000';

const redis = new Redis(env.REDIS_URL, { maxRetriesPerRequest: null });
const dispatchQueue = new Queue<{ orderId: string }>('dispatch', { connection: redis });

const enqueuedOrderIds = new Set<string>();
const processedEvents = new Set<string>();

const paymentRouterAbi = [
  {
    type: 'event',
    name: 'OrderPaid',
    inputs: [
      { indexed: true, name: 'orderId', type: 'bytes32' },
      { indexed: true, name: 'serviceId', type: 'bytes32' },
      { indexed: true, name: 'buyer', type: 'address' },
      { indexed: false, name: 'supplier', type: 'address' },
      { indexed: false, name: 'token', type: 'address' },
      { indexed: false, name: 'amount', type: 'uint256' },
      { indexed: false, name: 'timestamp', type: 'uint256' }
    ]
  }
] as const;

async function apiGet<T>(path: string): Promise<T> {
  const response = await fetch(`${apiBase}${path}`);
  if (!response.ok) {
    throw new Error(`GET ${path} failed with ${response.status}`);
  }
  return (await response.json()) as T;
}

async function apiPost<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(`${apiBase}${path}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-internal-secret': env.CALLBACK_HMAC_SECRET
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`POST ${path} failed with ${response.status}: ${text}`);
  }

  return (await response.json()) as T;
}

async function markOrderPaidFromEvent(log: { orderId: `0x${string}`; txHash: string }): Promise<void> {
  const key = `${log.txHash}:${log.orderId}`;
  if (processedEvents.has(key)) {
    return;
  }

  const createdOrders = await apiGet<Order[]>('/v1/orders?status=CREATED');
  const matched = createdOrders.find((order) => order.order_id_hex.toLowerCase() === log.orderId.toLowerCase());

  if (!matched) {
    logger.warn({ orderIdHex: log.orderId }, 'no created order matched chain event');
    return;
  }

  await apiPost<Order>(`/v1/internal/orders/${matched.order_id}/transition`, {
    to: 'PAID',
    tx_hash: log.txHash
  });

  processedEvents.add(key);
  recordMetric({ name: 'orders_paid_total', value: 1 });
  logger.info({ order_id: matched.order_id, tx_hash: log.txHash }, 'order marked paid from chain event');
}

async function enqueuePaidOrders(): Promise<void> {
  const paidOrders = await apiGet<Order[]>('/v1/orders?status=PAID');

  for (const order of paidOrders) {
    if (enqueuedOrderIds.has(order.order_id)) {
      continue;
    }

    await dispatchQueue.add(
      'dispatch-order',
      { orderId: order.order_id },
      {
        attempts: env.DISPATCH_MAX_RETRY + 1,
        removeOnComplete: true,
        removeOnFail: false,
        jobId: `dispatch:${order.order_id}`
      }
    );

    enqueuedOrderIds.add(order.order_id);
    logger.info({ order_id: order.order_id }, 'enqueued paid order for dispatch');
  }
}

function startDispatchWorker(): Worker<{ orderId: string }> {
  return new Worker(
    'dispatch',
    async (job) => {
      const order = await apiGet<Order>(`/v1/orders/${job.data.orderId}`);
      if (order.status !== 'PAID') {
        logger.info({ order_id: order.order_id, status: order.status }, 'skip dispatch for non-paid order');
        return;
      }

      await apiPost<Order>(`/v1/internal/orders/${order.order_id}/transition`, { to: 'RUNNING' });

      const service = await apiGet<ServiceManifest>(`/v1/services/${order.service_id}`);
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), env.SUPPLIER_TIMEOUT_MS);

      try {
        const response = await fetch(service.endpoint, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          signal: controller.signal,
          body: JSON.stringify({
            order_id: order.order_id,
            service_id: order.service_id,
            input: order.input_payload,
            callback_url: `${apiBase}/v1/orders/${order.order_id}/callback`
          })
        });

        if (!response.ok) {
          throw new Error(`supplier endpoint returned ${response.status}`);
        }

        logger.info({ order_id: order.order_id }, 'supplier dispatch accepted');
      } catch (error) {
        await apiPost<Order>(`/v1/internal/orders/${order.order_id}/transition`, { to: 'FAILED', error_message: (error as Error).message });
        throw error;
      } finally {
        clearTimeout(timer);
      }
    },
    {
      connection: redis,
      concurrency: 5
    }
  );
}

function startOrderPaidListener(): void {
  const client = createPublicClient({
    chain: bsc,
    transport: http(env.RPC_URL)
  });

  client.watchContractEvent({
    address: env.PAYMENT_ROUTER_ADDRESS as `0x${string}`,
    abi: paymentRouterAbi,
    eventName: 'OrderPaid',
    onLogs: async (logs) => {
      for (const log of logs) {
        if (!log.transactionHash || !log.args.orderId) {
          continue;
        }

        try {
          await markOrderPaidFromEvent({
            orderId: log.args.orderId,
            txHash: log.transactionHash
          });
        } catch (error) {
          logger.error({ err: error, tx_hash: log.transactionHash }, 'failed to process OrderPaid log');
        }
      }
    },
    onError: (error) => {
      logger.error({ err: error }, 'chain event listener error');
    },
    pollingInterval: 4_000
  });

  logger.info('order paid listener started');
}

async function main(): Promise<void> {
  const dispatchWorker = startDispatchWorker();
  dispatchWorker.on('failed', (job, error) => {
    logger.error({ err: error, jobId: job?.id }, 'dispatch job failed');
  });

  startOrderPaidListener();
  setInterval(() => {
    void enqueuePaidOrders().catch((error) => {
      logger.error({ err: error }, 'failed to enqueue paid orders');
    });
  }, 3_000);

  logger.info('worker started');
}

main().catch((error) => {
  logger.error({ err: error }, 'worker crashed at startup');
  process.exit(1);
});
