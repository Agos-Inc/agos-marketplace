import type { CreateOrderRequest, Order } from '@agos/shared-types';

export type ConsumerClient = {
  createOrder: (payload: CreateOrderRequest) => Promise<Order>;
  getOrder: (orderId: string) => Promise<Order>;
};

export function createConsumerClient(baseUrl: string): ConsumerClient {
  async function createOrder(payload: CreateOrderRequest): Promise<Order> {
    const response = await fetch(`${baseUrl}/v1/orders`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error(`createOrder failed: ${response.status}`);
    }

    return (await response.json()) as Order;
  }

  async function getOrder(orderId: string): Promise<Order> {
    const response = await fetch(`${baseUrl}/v1/orders/${orderId}`);

    if (!response.ok) {
      throw new Error(`getOrder failed: ${response.status}`);
    }

    return (await response.json()) as Order;
  }

  return {
    createOrder,
    getOrder
  };
}
