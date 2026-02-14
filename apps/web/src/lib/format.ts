import type { Order, OrderCounts } from './types';

export function shortHex(value: string, head = 6, tail = 4): string {
  if (value.length <= head + tail + 2) {
    return value;
  }
  return `${value.slice(0, head)}...${value.slice(-tail)}`;
}

export function formatTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString();
}

export function prettyJson(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

export function byLatestUpdated(a: Order, b: Order): number {
  return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
}

export function countOrders(orders: Order[]): OrderCounts {
  return {
    all: orders.length,
    paid: orders.filter((order) => order.status === 'PAID').length,
    running: orders.filter((order) => order.status === 'RUNNING').length,
    completed: orders.filter((order) => order.status === 'COMPLETED').length,
    failed: orders.filter((order) => order.status === 'FAILED').length
  };
}
