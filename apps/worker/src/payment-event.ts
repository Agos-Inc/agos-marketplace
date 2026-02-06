import type { Order } from '@agos/shared-types';

export type OrderPaidLog = {
  orderIdHex: `0x${string}`;
  serviceIdHex: `0x${string}`;
  buyer: `0x${string}`;
  supplier: `0x${string}`;
  token: `0x${string}`;
  amountAtomic: bigint;
  txHash: string;
  blockNumber: bigint;
  logIndex: number;
};

export type RawOrderPaidLog = {
  args: {
    orderId?: `0x${string}` | undefined;
    serviceId?: `0x${string}` | undefined;
    buyer?: `0x${string}` | undefined;
    supplier?: `0x${string}` | undefined;
    token?: `0x${string}` | undefined;
    amount?: bigint | undefined;
  };
  transactionHash: `0x${string}` | null;
  blockNumber?: bigint | null;
  logIndex?: number | null;
};

function normalize(value: string): string {
  return value.toLowerCase();
}

function sameAddress(left: string, right: string): boolean {
  return normalize(left) === normalize(right);
}

export function parseOrderPaidLog(log: RawOrderPaidLog): OrderPaidLog | null {
  if (
    !log.transactionHash ||
    !log.args.orderId ||
    !log.args.serviceId ||
    !log.args.buyer ||
    !log.args.supplier ||
    !log.args.token ||
    log.args.amount === undefined ||
    log.logIndex === undefined ||
    log.logIndex === null
  ) {
    return null;
  }

  return {
    orderIdHex: log.args.orderId,
    serviceIdHex: log.args.serviceId,
    buyer: log.args.buyer,
    supplier: log.args.supplier,
    token: log.args.token,
    amountAtomic: log.args.amount,
    txHash: log.transactionHash,
    blockNumber: log.blockNumber ?? 0n,
    logIndex: log.logIndex
  };
}

export function hasExpectedPaymentToken(log: OrderPaidLog, expectedToken: string): boolean {
  return sameAddress(log.token, expectedToken);
}

export function getOrderPaidMismatchReason(order: Order, log: OrderPaidLog): string | null {
  if (!sameAddress(order.service_id_hex, log.serviceIdHex)) {
    return 'service_id_hex mismatch';
  }

  if (!sameAddress(order.buyer_wallet, log.buyer)) {
    return 'buyer mismatch';
  }

  if (!sameAddress(order.supplier_wallet, log.supplier)) {
    return 'supplier mismatch';
  }

  if (!sameAddress(order.token_address, log.token)) {
    return 'token mismatch';
  }

  if (order.amount_atomic !== log.amountAtomic.toString()) {
    return 'amount mismatch';
  }

  return null;
}
