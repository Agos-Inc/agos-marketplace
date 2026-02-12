import type { Listing, Order, PaymentPreparation, Purchase } from './types';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:3000';

export class ApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

async function parseError(response: Response): Promise<string> {
  const text = await response.text();
  if (!text) {
    return `Request failed (${response.status})`;
  }

  try {
    const parsed = JSON.parse(text) as { message?: string };
    return parsed.message ?? text;
  } catch {
    return text;
  }
}

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      accept: 'application/json',
      ...(init?.body ? { 'content-type': 'application/json' } : {}),
      ...(init?.headers ?? {})
    },
    cache: 'no-store'
  });

  if (!response.ok) {
    throw new ApiError(await parseError(response), response.status);
  }

  return (await response.json()) as T;
}

export function getApiBaseUrl(): string {
  return API_BASE_URL;
}

export async function listListings(): Promise<Listing[]> {
  const listings = await requestJson<Listing[]>('/v1/openclaw/listings');
  return listings.filter((listing) => listing.is_active);
}

export async function listOrders(status?: string): Promise<Order[]> {
  const suffix = status ? `?status=${encodeURIComponent(status)}` : '';
  return requestJson<Order[]>(`/v1/orders${suffix}`);
}

export async function getOrder(orderId: string): Promise<Order> {
  return requestJson<Order>(`/v1/orders/${encodeURIComponent(orderId)}`);
}

export async function createPurchase(input: {
  listing_id: string;
  buyer_wallet: string;
  input_payload: Record<string, unknown>;
}): Promise<Purchase> {
  return requestJson<Purchase>('/v1/openclaw/purchases', {
    method: 'POST',
    body: JSON.stringify(input)
  });
}

export async function preparePayment(purchaseId: string): Promise<PaymentPreparation> {
  return requestJson<PaymentPreparation>(`/v1/openclaw/purchases/${encodeURIComponent(purchaseId)}/prepare-payment`, {
    method: 'POST',
    body: JSON.stringify({})
  });
}

export async function getPurchase(purchaseId: string): Promise<Purchase> {
  return requestJson<Purchase>(`/v1/openclaw/purchases/${encodeURIComponent(purchaseId)}`);
}
