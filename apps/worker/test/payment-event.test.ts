import { describe, expect, it } from 'vitest';
import type { Order } from '@agos/shared-types';
import {
  getOrderPaidMismatchReason,
  hasExpectedPaymentToken,
  parseOrderPaidLog,
  type RawOrderPaidLog
} from '../src/payment-event.js';

const baseOrder: Order = {
  order_id: 'ord_demo_001',
  order_id_hex: '0x1111111111111111111111111111111111111111111111111111111111111111',
  service_id: 'svc_demo_v1',
  service_id_hex: '0x2222222222222222222222222222222222222222222222222222222222222222',
  buyer_wallet: '0x0000000000000000000000000000000000000001',
  supplier_wallet: '0x0000000000000000000000000000000000000002',
  amount_usdt: '1.0',
  amount_atomic: '1000000',
  token_decimals: 6,
  token_address: '0x0000000000000000000000000000000000000003',
  chain_id: 56,
  status: 'CREATED',
  input_payload: { prompt: 'hello' },
  result_payload: null,
  error_message: null,
  tx_hash: null,
  created_at: '2026-02-06T00:00:00.000Z',
  updated_at: '2026-02-06T00:00:00.000Z'
};

function buildRawLog(overrides?: Partial<RawOrderPaidLog>): RawOrderPaidLog {
  return {
    args: {
      orderId: baseOrder.order_id_hex,
      serviceId: baseOrder.service_id_hex,
      buyer: baseOrder.buyer_wallet,
      supplier: baseOrder.supplier_wallet,
      token: baseOrder.token_address,
      amount: 1_000_000n
    },
    transactionHash: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    blockNumber: 123n,
    logIndex: 0,
    ...overrides
  };
}

describe('payment-event helpers', () => {
  it('parses valid raw OrderPaid logs', () => {
    const parsed = parseOrderPaidLog(buildRawLog());
    expect(parsed).not.toBeNull();
    expect(parsed?.orderIdHex).toBe(baseOrder.order_id_hex);
    expect(parsed?.amountAtomic).toBe(1_000_000n);
  });

  it('defaults blockNumber to 0 when absent', () => {
    const parsed = parseOrderPaidLog(buildRawLog({ blockNumber: null }));
    expect(parsed?.blockNumber).toBe(0n);
  });

  it('rejects malformed raw logs', () => {
    const malformed = buildRawLog();
    malformed.args.orderId = undefined;
    const parsed = parseOrderPaidLog(malformed);
    expect(parsed).toBeNull();
  });

  it('checks expected token', () => {
    const parsed = parseOrderPaidLog(buildRawLog());
    expect(parsed).not.toBeNull();
    if (!parsed) {
      throw new Error('parsed should not be null');
    }
    expect(hasExpectedPaymentToken(parsed, baseOrder.token_address)).toBe(true);
    expect(hasExpectedPaymentToken(parsed, '0x0000000000000000000000000000000000000004')).toBe(false);
  });

  it('returns mismatch reason when order fields differ', () => {
    const parsed = parseOrderPaidLog(
      buildRawLog({
        args: {
          orderId: baseOrder.order_id_hex,
          serviceId: baseOrder.service_id_hex,
          buyer: baseOrder.buyer_wallet,
          supplier: baseOrder.supplier_wallet,
          token: baseOrder.token_address,
          amount: 2_000_000n
        }
      })
    );

    expect(parsed).not.toBeNull();
    if (!parsed) {
      throw new Error('parsed should not be null');
    }

    expect(getOrderPaidMismatchReason(baseOrder, parsed)).toBe('amount mismatch');
  });

  it('passes when order and log are consistent', () => {
    const parsed = parseOrderPaidLog(buildRawLog());
    expect(parsed).not.toBeNull();
    if (!parsed) {
      throw new Error('parsed should not be null');
    }

    expect(getOrderPaidMismatchReason(baseOrder, parsed)).toBeNull();
  });
});
