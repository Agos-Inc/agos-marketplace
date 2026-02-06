import { randomUUID, createHmac } from 'node:crypto';
import { PrismaClient, Prisma, type Order as PrismaOrderRecord, type Service as PrismaServiceRecord } from '@prisma/client';
import {
  canTransition,
  createOrderRequestSchema,
  idToHex,
  type Order,
  ORDER_STATES,
  type OrderCallback,
  type OrderState,
  orderSchema,
  priceToAtomic,
  serviceManifestSchema,
  type ServiceManifest
} from '@agos/shared-types';

export type InternalTransitionInput = {
  to: OrderState;
  tx_hash?: string;
  error_message?: string;
};

export type TransitionMetadata = {
  tx_hash?: string;
  error_message?: string;
};

type NormalizedServiceManifest = ServiceManifest & {
  service_id_hex: string;
  price_atomic: string;
};

export interface Store {
  readonly provider: 'in-memory' | 'postgres';
  registerService(input: unknown): Promise<ServiceManifest>;
  listServices(): Promise<ServiceManifest[]>;
  getService(serviceId: string): Promise<ServiceManifest | null>;
  createOrder(input: unknown, usdtAddress: string, chainId: number): Promise<Order>;
  listOrders(status?: OrderState): Promise<Order[]>;
  getOrder(orderId: string): Promise<Order | null>;
  transitionOrder(orderId: string, to: OrderState, metadata?: TransitionMetadata): Promise<Order>;
  applySupplierCallback(orderId: string, callback: OrderCallback): Promise<Order>;
  verifyAndConsumeNonce(nonce: string): Promise<boolean>;
  close?(): Promise<void>;
}

function ensureObjectRecord(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
  return value as Record<string, unknown>;
}

function normalizeServiceManifest(input: unknown): NormalizedServiceManifest {
  const manifest = serviceManifestSchema.parse(input);
  return {
    ...manifest,
    service_id_hex: manifest.service_id_hex ?? idToHex(manifest.service_id),
    price_atomic: manifest.price_atomic ?? priceToAtomic(manifest.price_usdt, manifest.token_decimals).toString()
  };
}

function serviceFromPrisma(record: PrismaServiceRecord): ServiceManifest {
  return serviceManifestSchema.parse({
    service_id: record.serviceId,
    service_id_hex: record.serviceIdHex,
    name: record.name,
    description: record.description,
    input_schema: ensureObjectRecord(record.inputSchema, 'input_schema'),
    output_schema: ensureObjectRecord(record.outputSchema, 'output_schema'),
    price_usdt: record.priceUsdt,
    price_atomic: record.priceAtomic,
    token_decimals: record.tokenDecimals,
    endpoint: record.endpoint,
    supplier_wallet: record.supplierWallet,
    version: record.version,
    is_active: record.isActive
  });
}

function orderFromPrisma(record: PrismaOrderRecord): Order {
  return orderSchema.parse({
    order_id: record.orderId,
    order_id_hex: record.orderIdHex,
    service_id: record.serviceId,
    service_id_hex: record.serviceIdHex,
    buyer_wallet: record.buyerWallet,
    supplier_wallet: record.supplierWallet,
    amount_usdt: record.amountUsdt,
    amount_atomic: record.amountAtomic,
    token_decimals: record.tokenDecimals,
    token_address: record.tokenAddress,
    chain_id: record.chainId,
    status: record.status,
    input_payload: ensureObjectRecord(record.inputPayload, 'input_payload'),
    result_payload: record.resultPayload ? ensureObjectRecord(record.resultPayload, 'result_payload') : null,
    error_message: record.errorMessage,
    tx_hash: record.txHash,
    created_at: record.createdAt.toISOString(),
    updated_at: record.updatedAt.toISOString()
  });
}

function isPrismaKnownRequestError(error: unknown): error is Prisma.PrismaClientKnownRequestError {
  return error instanceof Error && 'code' in error;
}

export class InMemoryStore implements Store {
  readonly provider = 'in-memory' as const;
  private readonly services = new Map<string, ServiceManifest>();
  private readonly orders = new Map<string, Order>();
  private readonly usedCallbackNonces = new Set<string>();

  async registerService(input: unknown): Promise<ServiceManifest> {
    const normalized = normalizeServiceManifest(input);
    this.services.set(normalized.service_id, normalized);
    return normalized;
  }

  async listServices(): Promise<ServiceManifest[]> {
    return [...this.services.values()].filter((service) => service.is_active);
  }

  async getService(serviceId: string): Promise<ServiceManifest | null> {
    return this.services.get(serviceId) ?? null;
  }

  async createOrder(input: unknown, usdtAddress: string, chainId: number): Promise<Order> {
    const payload = createOrderRequestSchema.parse(input);
    const service = this.services.get(payload.service_id);

    if (!service) {
      throw new Error(`service not found: ${payload.service_id}`);
    }

    const orderId = `ord_${Date.now()}_${randomUUID().slice(0, 8)}`;
    const nowIso = new Date().toISOString();

    const order: Order = {
      order_id: orderId,
      order_id_hex: idToHex(orderId),
      service_id: service.service_id,
      service_id_hex: service.service_id_hex ?? idToHex(service.service_id),
      buyer_wallet: payload.buyer_wallet,
      supplier_wallet: service.supplier_wallet,
      amount_usdt: service.price_usdt,
      amount_atomic: service.price_atomic ?? priceToAtomic(service.price_usdt, service.token_decimals).toString(),
      token_decimals: service.token_decimals,
      token_address: usdtAddress,
      chain_id: chainId,
      status: 'CREATED',
      input_payload: payload.input_payload,
      result_payload: null,
      error_message: null,
      tx_hash: null,
      created_at: nowIso,
      updated_at: nowIso
    };

    const parsed = orderSchema.parse(order);
    this.orders.set(parsed.order_id, parsed);
    return parsed;
  }

  async listOrders(status?: OrderState): Promise<Order[]> {
    const orders = [...this.orders.values()];
    return status ? orders.filter((order) => order.status === status) : orders;
  }

  async getOrder(orderId: string): Promise<Order | null> {
    return this.orders.get(orderId) ?? null;
  }

  async transitionOrder(orderId: string, to: OrderState, metadata?: TransitionMetadata): Promise<Order> {
    const current = this.orders.get(orderId);
    if (!current) {
      throw new Error(`order not found: ${orderId}`);
    }

    if (!canTransition(current.status, to)) {
      throw new Error(`invalid transition: ${current.status} -> ${to}`);
    }

    const next: Order = {
      ...current,
      status: to,
      tx_hash: metadata?.tx_hash ?? current.tx_hash,
      error_message: metadata?.error_message ?? current.error_message,
      updated_at: new Date().toISOString()
    };

    this.orders.set(orderId, next);
    return next;
  }

  async applySupplierCallback(orderId: string, callback: OrderCallback): Promise<Order> {
    const current = this.orders.get(orderId);
    if (!current) {
      throw new Error(`order not found: ${orderId}`);
    }

    if (current.status !== 'RUNNING') {
      throw new Error(`callback rejected: order in ${current.status}`);
    }

    const status = callback.status;
    if (!ORDER_STATES.includes(status)) {
      throw new Error(`unsupported callback status: ${status}`);
    }

    const next: Order = {
      ...current,
      status,
      result_payload: callback.output ?? null,
      error_message: callback.error ?? null,
      updated_at: new Date().toISOString()
    };

    this.orders.set(orderId, next);
    return next;
  }

  async verifyAndConsumeNonce(nonce: string): Promise<boolean> {
    if (this.usedCallbackNonces.has(nonce)) {
      return false;
    }
    this.usedCallbackNonces.add(nonce);
    return true;
  }
}

export class PrismaStore implements Store {
  readonly provider = 'postgres' as const;

  constructor(private readonly prisma: PrismaClient) {}

  async registerService(input: unknown): Promise<ServiceManifest> {
    const normalized = normalizeServiceManifest(input);
    const saved = await this.prisma.service.upsert({
      where: { serviceId: normalized.service_id },
      create: {
        serviceId: normalized.service_id,
        serviceIdHex: normalized.service_id_hex,
        name: normalized.name,
        description: normalized.description,
        inputSchema: normalized.input_schema as Prisma.InputJsonValue,
        outputSchema: normalized.output_schema as Prisma.InputJsonValue,
        priceUsdt: normalized.price_usdt,
        priceAtomic: normalized.price_atomic,
        tokenDecimals: normalized.token_decimals,
        endpoint: normalized.endpoint,
        supplierWallet: normalized.supplier_wallet,
        version: normalized.version,
        isActive: normalized.is_active
      },
      update: {
        serviceIdHex: normalized.service_id_hex,
        name: normalized.name,
        description: normalized.description,
        inputSchema: normalized.input_schema as Prisma.InputJsonValue,
        outputSchema: normalized.output_schema as Prisma.InputJsonValue,
        priceUsdt: normalized.price_usdt,
        priceAtomic: normalized.price_atomic,
        tokenDecimals: normalized.token_decimals,
        endpoint: normalized.endpoint,
        supplierWallet: normalized.supplier_wallet,
        version: normalized.version,
        isActive: normalized.is_active
      }
    });

    return serviceFromPrisma(saved);
  }

  async listServices(): Promise<ServiceManifest[]> {
    const rows = await this.prisma.service.findMany({
      where: { isActive: true },
      orderBy: { createdAt: 'desc' }
    });

    return rows.map(serviceFromPrisma);
  }

  async getService(serviceId: string): Promise<ServiceManifest | null> {
    const row = await this.prisma.service.findUnique({ where: { serviceId } });
    return row ? serviceFromPrisma(row) : null;
  }

  async createOrder(input: unknown, usdtAddress: string, chainId: number): Promise<Order> {
    const payload = createOrderRequestSchema.parse(input);
    const service = await this.prisma.service.findUnique({
      where: { serviceId: payload.service_id }
    });

    if (!service) {
      throw new Error(`service not found: ${payload.service_id}`);
    }

    const orderId = `ord_${Date.now()}_${randomUUID().slice(0, 8)}`;
    const row = await this.prisma.order.create({
      data: {
        orderId,
        orderIdHex: idToHex(orderId),
        serviceId: service.serviceId,
        serviceIdHex: service.serviceIdHex,
        buyerWallet: payload.buyer_wallet,
        supplierWallet: service.supplierWallet,
        amountUsdt: service.priceUsdt,
        amountAtomic: service.priceAtomic,
        tokenDecimals: service.tokenDecimals,
        tokenAddress: usdtAddress,
        chainId,
        status: 'CREATED',
        inputPayload: payload.input_payload as Prisma.InputJsonValue,
        resultPayload: Prisma.DbNull,
        errorMessage: null,
        txHash: null
      }
    });

    return orderFromPrisma(row);
  }

  async listOrders(status?: OrderState): Promise<Order[]> {
    const rows = status
      ? await this.prisma.order.findMany({
          where: { status },
          orderBy: { createdAt: 'desc' }
        })
      : await this.prisma.order.findMany({
          orderBy: { createdAt: 'desc' }
        });

    return rows.map(orderFromPrisma);
  }

  async getOrder(orderId: string): Promise<Order | null> {
    const row = await this.prisma.order.findUnique({ where: { orderId } });
    return row ? orderFromPrisma(row) : null;
  }

  async transitionOrder(orderId: string, to: OrderState, metadata?: TransitionMetadata): Promise<Order> {
    const current = await this.prisma.order.findUnique({ where: { orderId } });
    if (!current) {
      throw new Error(`order not found: ${orderId}`);
    }

    if (!canTransition(current.status as OrderState, to)) {
      throw new Error(`invalid transition: ${current.status} -> ${to}`);
    }

    const next = await this.prisma.order.update({
      where: { orderId },
      data: {
        status: to,
        ...(metadata?.tx_hash !== undefined ? { txHash: metadata.tx_hash } : {}),
        ...(metadata?.error_message !== undefined ? { errorMessage: metadata.error_message } : {})
      }
    });

    return orderFromPrisma(next);
  }

  async applySupplierCallback(orderId: string, callback: OrderCallback): Promise<Order> {
    const current = await this.prisma.order.findUnique({ where: { orderId } });
    if (!current) {
      throw new Error(`order not found: ${orderId}`);
    }

    if (current.status !== 'RUNNING') {
      throw new Error(`callback rejected: order in ${current.status}`);
    }

    const status = callback.status;
    if (!ORDER_STATES.includes(status)) {
      throw new Error(`unsupported callback status: ${status}`);
    }

    const next = await this.prisma.order.update({
      where: { orderId },
      data: {
        status,
        resultPayload: callback.output ? (callback.output as Prisma.InputJsonValue) : Prisma.DbNull,
        errorMessage: callback.error ?? null
      }
    });

    return orderFromPrisma(next);
  }

  async verifyAndConsumeNonce(nonce: string): Promise<boolean> {
    try {
      await this.prisma.callbackNonce.create({
        data: { nonce }
      });
      return true;
    } catch (error) {
      if (isPrismaKnownRequestError(error) && error.code === 'P2002') {
        return false;
      }
      throw error;
    }
  }

  async close(): Promise<void> {
    await this.prisma.$disconnect();
  }
}

export function signCallback(payload: string, timestamp: string, nonce: string, secret: string): string {
  return createHmac('sha256', secret).update(`${timestamp}.${nonce}.${payload}`).digest('hex');
}
