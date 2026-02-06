import type { OrderState } from '@agos/shared-types';

export type AgosListing = {
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

export type AgosPurchase = {
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

export type PreparePaymentResult = {
  purchase_id: string;
  purchase_id_hex: string;
  listing_id: string;
  listing_id_hex: string;
  chain_id: number;
  token_address: string;
  payment_router_address: string;
  amount_atomic: string;
  supplier_wallet: string;
};

export type CreatePurchaseInput = {
  listing_id: string;
  buyer_wallet: string;
  input_payload: Record<string, unknown>;
};

export type WaitPurchaseOptions = {
  timeoutMs?: number;
  intervalMs?: number;
  terminalStates?: OrderState[];
};

export type AgosSdkOptions = {
  baseUrl: string;
  apiKey?: string;
  fetcher?: typeof fetch;
};

type RequestInitWithBody = {
  method?: 'GET' | 'POST';
  body?: unknown;
};

export class AgosSdkError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly payload?: unknown
  ) {
    super(message);
    this.name = 'AgosSdkError';
  }
}

export class AgosSdk {
  private readonly baseUrl: string;
  private readonly apiKey: string | undefined;
  private readonly fetcher: typeof fetch;

  constructor(options: AgosSdkOptions) {
    this.baseUrl = options.baseUrl.replace(/\/+$/, '');
    this.apiKey = options.apiKey;
    this.fetcher = options.fetcher ?? fetch;
  }

  async listListings(): Promise<AgosListing[]> {
    return this.request<AgosListing[]>('/v1/openclaw/listings');
  }

  async getListing(listingId: string): Promise<AgosListing> {
    return this.request<AgosListing>(`/v1/openclaw/listings/${listingId}`);
  }

  async createPurchase(input: CreatePurchaseInput): Promise<AgosPurchase> {
    return this.request<AgosPurchase>('/v1/openclaw/purchases', {
      method: 'POST',
      body: input
    });
  }

  async getPurchase(purchaseId: string): Promise<AgosPurchase> {
    return this.request<AgosPurchase>(`/v1/openclaw/purchases/${purchaseId}`);
  }

  async getPurchaseByHex(orderIdHex: string): Promise<AgosPurchase> {
    return this.request<AgosPurchase>(`/v1/openclaw/purchases/by-hex/${orderIdHex}`);
  }

  async preparePayment(purchaseId: string): Promise<PreparePaymentResult> {
    return this.request<PreparePaymentResult>(`/v1/openclaw/purchases/${purchaseId}/prepare-payment`, {
      method: 'POST'
    });
  }

  async waitForPurchase(purchaseId: string, options: WaitPurchaseOptions = {}): Promise<AgosPurchase> {
    const timeoutMs = options.timeoutMs ?? 120_000;
    const intervalMs = options.intervalMs ?? 2_000;
    const terminalStates = options.terminalStates ?? ['COMPLETED', 'FAILED'];
    const start = Date.now();

    while (Date.now() - start < timeoutMs) {
      const purchase = await this.getPurchase(purchaseId);
      if (terminalStates.includes(purchase.status)) {
        return purchase;
      }
      await new Promise((resolve) => setTimeout(resolve, intervalMs));
    }

    throw new Error(`waitForPurchase timeout after ${timeoutMs}ms`);
  }

  private async request<T>(path: string, init: RequestInitWithBody = {}): Promise<T> {
    const headers: Record<string, string> = {
      accept: 'application/json'
    };

    if (init.body !== undefined) {
      headers['content-type'] = 'application/json';
    }

    if (this.apiKey) {
      headers['x-api-key'] = this.apiKey;
    }

    const response = await this.fetcher(`${this.baseUrl}${path}`, {
      method: init.method ?? 'GET',
      headers,
      ...(init.body !== undefined ? { body: JSON.stringify(init.body) } : {})
    });

    if (!response.ok) {
      let payload: unknown;
      try {
        payload = await response.json();
      } catch {
        payload = await response.text();
      }
      throw new AgosSdkError(`request failed: ${response.status} ${path}`, response.status, payload);
    }

    return (await response.json()) as T;
  }
}

export function createAgosSdk(options: AgosSdkOptions): AgosSdk {
  return new AgosSdk(options);
}
