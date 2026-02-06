import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.string().default('development'),
  PORT: z.coerce.number().default(3000),
  DATABASE_URL: z.string().default('postgres://postgres:postgres@localhost:5432/agos'),
  REDIS_URL: z.string().default('redis://localhost:6379'),
  RPC_URL: z.url().default('https://bsc-dataseed.binance.org'),
  CHAIN_ID: z.coerce.number().default(56),
  USDT_ADDRESS: z.string().default('0x0000000000000000000000000000000000000000'),
  PAYMENT_ROUTER_ADDRESS: z.string().default('0x0000000000000000000000000000000000000000'),
  MIN_CONFIRMATIONS: z.coerce.number().default(3),
  SUPPLIER_TIMEOUT_MS: z.coerce.number().default(30000),
  DISPATCH_MAX_RETRY: z.coerce.number().default(1),
  CALLBACK_HMAC_SECRET: z.string().default('dev-secret')
});

export type AppEnv = z.infer<typeof envSchema>;

export function loadEnv(overrides?: Record<string, string | undefined>): AppEnv {
  const merged = {
    ...process.env,
    ...overrides
  };
  return envSchema.parse(merged);
}
