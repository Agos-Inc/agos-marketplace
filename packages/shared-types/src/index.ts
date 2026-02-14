import { keccak256, parseUnits, toHex } from 'viem';
import { z } from 'zod';

export const ORDER_STATES = [
  'CREATED',
  'PAID',
  'RUNNING',
  'COMPLETED',
  'FAILED'
] as const;

export type OrderState = (typeof ORDER_STATES)[number];

export const ALLOWED_TRANSITIONS: Readonly<Record<OrderState, readonly OrderState[]>> = {
  CREATED: ['PAID'],
  PAID: ['RUNNING'],
  RUNNING: ['COMPLETED', 'FAILED'],
  COMPLETED: [],
  FAILED: []
};

export function canTransition(from: OrderState, to: OrderState): boolean {
  return ALLOWED_TRANSITIONS[from].includes(to);
}

export function assertValidTransition(from: OrderState, to: OrderState): void {
  if (!canTransition(from, to)) {
    throw new Error(`invalid transition: ${from} -> ${to}`);
  }
}

export function idToHex(value: string): `0x${string}` {
  const normalized = value.trim();
  if (!normalized) {
    throw new Error('id cannot be empty');
  }
  return keccak256(toHex(normalized));
}

export const DEFAULT_TOKEN_DECIMALS = 18;

export function priceToAtomic(price: string, decimals = DEFAULT_TOKEN_DECIMALS): bigint {
  if (!Number.isInteger(decimals) || decimals <= 0) {
    throw new Error('decimals must be a positive integer');
  }

  const normalized = price.trim();
  if (!normalized) {
    throw new Error('price must be a positive decimal string');
  }

  let atomic: bigint;
  try {
    atomic = parseUnits(normalized, decimals);
  } catch {
    throw new Error('price must be a positive decimal string');
  }

  if (atomic <= 0n) {
    throw new Error('price must be greater than zero');
  }

  return atomic;
}

const addressSchema = z.string().regex(/^0x[a-fA-F0-9]{40}$/, 'invalid address');

export const serviceManifestSchema = z.object({
  service_id: z.string().min(3),
  service_id_hex: z.string().regex(/^0x[a-fA-F0-9]{64}$/).optional(),
  name: z.string().min(1),
  description: z.string().min(1),
  input_schema: z.record(z.string(), z.unknown()),
  output_schema: z.record(z.string(), z.unknown()),
  price_usdt: z.string(),
  price_atomic: z.string().optional(),
  token_decimals: z.number().int().positive().default(DEFAULT_TOKEN_DECIMALS),
  endpoint: z.url(),
  supplier_wallet: addressSchema,
  version: z.string().default('1.0.0'),
  is_active: z.boolean().default(true)
});

export type ServiceManifest = z.infer<typeof serviceManifestSchema>;

export const orderSchema = z.object({
  order_id: z.string().min(3),
  order_id_hex: z.string().regex(/^0x[a-fA-F0-9]{64}$/),
  service_id: z.string().min(3),
  service_id_hex: z.string().regex(/^0x[a-fA-F0-9]{64}$/),
  buyer_wallet: addressSchema,
  supplier_wallet: addressSchema,
  amount_usdt: z.string(),
  amount_atomic: z.string(),
  token_decimals: z.number().int().positive().default(DEFAULT_TOKEN_DECIMALS),
  token_address: addressSchema,
  chain_id: z.number().int().positive(),
  status: z.enum(ORDER_STATES),
  input_payload: z.record(z.string(), z.unknown()),
  result_payload: z.record(z.string(), z.unknown()).nullable(),
  error_message: z.string().nullable(),
  tx_hash: z.string().regex(/^0x[a-fA-F0-9]{64}$/).nullable(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime()
});

export type Order = z.infer<typeof orderSchema>;

export const paymentProofSchema = z.object({
  order_id: z.string().min(3),
  order_id_hex: z.string().regex(/^0x[a-fA-F0-9]{64}$/),
  service_id: z.string().min(3),
  service_id_hex: z.string().regex(/^0x[a-fA-F0-9]{64}$/),
  tx_hash: z.string().regex(/^0x[a-fA-F0-9]{64}$/),
  block_number: z.number().int().nonnegative(),
  log_index: z.number().int().nonnegative(),
  buyer: addressSchema,
  supplier: addressSchema,
  token: addressSchema,
  amount_atomic: z.string(),
  confirmations: z.number().int().nonnegative(),
  verified_at: z.string().datetime()
});

export type PaymentProof = z.infer<typeof paymentProofSchema>;

export const createOrderRequestSchema = z.object({
  service_id: z.string().min(3),
  buyer_wallet: addressSchema,
  input_payload: z.record(z.string(), z.unknown())
});

export type CreateOrderRequest = z.infer<typeof createOrderRequestSchema>;

export const callbackHeadersSchema = z.object({
  'x-callback-timestamp': z.string(),
  'x-callback-nonce': z.string(),
  'x-callback-signature': z.string()
});

export const orderCallbackSchema = z.object({
  order_id: z.string().min(3),
  status: z.enum(['COMPLETED', 'FAILED']),
  output: z.record(z.string(), z.unknown()).nullable().optional(),
  error: z.string().nullable().optional()
});

export type OrderCallback = z.infer<typeof orderCallbackSchema>;
