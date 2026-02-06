import Fastify from 'fastify';
import cors from '@fastify/cors';
import { loadEnv } from '@agos/config';
import { logger } from '@agos/observability';
import { buildSignedCallback } from '@agos/sdk-supplier';

const env = loadEnv();
const port = Number(process.env.SUPPLIER_PORT ?? 3003);

const app = Fastify({ loggerInstance: logger });
app.register(cors, { origin: true });

app.get('/health', async () => ({ ok: true, ts: new Date().toISOString() }));

app.post('/task', async (request, reply) => {
  const body = request.body as {
    order_id: string;
    service_id: string;
    input: Record<string, unknown>;
    callback_url: string;
  };

  setTimeout(async () => {
    const shouldFail = Boolean(body.input?.fail);
    const callback = buildSignedCallback(
      {
        order_id: body.order_id,
        status: shouldFail ? 'FAILED' : 'COMPLETED',
        output: shouldFail ? null : { summary: `Mock result for ${body.service_id}` },
        error: shouldFail ? 'mock requested failure' : null
      },
      env.CALLBACK_HMAC_SECRET
    );

    try {
      await fetch(body.callback_url, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...callback.headers
        },
        body: JSON.stringify(callback.payload)
      });

      logger.info({ order_id: body.order_id }, 'callback sent from supplier-mock');
    } catch (error) {
      logger.error({ err: error, order_id: body.order_id }, 'supplier-mock callback failed');
    }
  }, 1200);

  return reply.code(202).send({ accepted: true, order_id: body.order_id });
});

app
  .listen({ host: '0.0.0.0', port })
  .then(() => {
    logger.info({ port }, 'supplier-mock started');
  })
  .catch((error) => {
    logger.error({ err: error }, 'failed to start supplier-mock');
    process.exit(1);
  });
