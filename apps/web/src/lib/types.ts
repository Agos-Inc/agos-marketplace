export const ORDER_STATES = ['CREATED', 'PAID', 'RUNNING', 'COMPLETED', 'FAILED'] as const;

export type OrderState = (typeof ORDER_STATES)[number];

export type Listing = {
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

export type Order = {
  order_id: string;
  order_id_hex: string;
  service_id: string;
  service_id_hex: string;
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
  input_payload: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type Purchase = {
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

export type PaymentPreparation = {
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

export type OrderCounts = {
  all: number;
  paid: number;
  running: number;
  completed: number;
  failed: number;
};
