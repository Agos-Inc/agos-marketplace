import { loadEnv } from '@agos/config';
import { logger } from '@agos/observability';
import { buildApp } from './app.js';

async function main() {
  const env = loadEnv();
  const app = buildApp();

  try {
    await app.listen({ port: env.PORT, host: '0.0.0.0' });
    logger.info({ port: env.PORT }, 'api server started');
  } catch (error) {
    logger.error({ err: error }, 'failed to start api server');
    process.exit(1);
  }
}

main();
