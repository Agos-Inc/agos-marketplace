'use client';

import { useEffect, useMemo, useState } from 'react';

type Service = {
  service_id: string;
  name: string;
  description: string;
  price_usdt: string;
};

type Order = {
  order_id: string;
  service_id: string;
  status: string;
  tx_hash: string | null;
  error_message: string | null;
  result_payload: Record<string, unknown> | null;
};

const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:3000';

export default function Page() {
  const [services, setServices] = useState<Service[]>([]);
  const [serviceId, setServiceId] = useState('');
  const [buyerWallet, setBuyerWallet] = useState('0x0000000000000000000000000000000000000002');
  const [inputJson, setInputJson] = useState('{"topic":"DeAI market overview"}');
  const [lastOrder, setLastOrder] = useState<Order | null>(null);
  const [orderIdQuery, setOrderIdQuery] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    void fetch(`${apiBase}/v1/services`)
      .then((res) => res.json())
      .then((json) => {
        const list = json as Service[];
        setServices(list);
        const first = list.at(0);
        if (first) {
          setServiceId(first.service_id);
        }
      })
      .catch(() => {
        setServices([]);
      });
  }, []);

  const selected = useMemo(() => services.find((item) => item.service_id === serviceId), [services, serviceId]);

  async function createOrder(): Promise<void> {
    setLoading(true);
    try {
      const inputPayload = JSON.parse(inputJson) as Record<string, unknown>;
      const response = await fetch(`${apiBase}/v1/orders`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          service_id: serviceId,
          buyer_wallet: buyerWallet,
          input_payload: inputPayload
        })
      });

      const order = (await response.json()) as Order;
      setLastOrder(order);
      setOrderIdQuery(order.order_id);
    } finally {
      setLoading(false);
    }
  }

  async function fetchOrder(orderId: string): Promise<void> {
    if (!orderId) {
      return;
    }
    const response = await fetch(`${apiBase}/v1/orders/${orderId}`);
    if (!response.ok) {
      return;
    }
    const order = (await response.json()) as Order;
    setLastOrder(order);
  }

  return (
    <main>
      <h1>Claw Marketplace Demo Panel</h1>
      <p className="muted">OpenClaw / BSC-only developer panel. Wallet pay flow will be connected next.</p>

      <section className="panel">
        <h2>Services</h2>
        <div className="grid">
          {services.map((service) => (
            <article key={service.service_id} className="panel">
              <h3>{service.name}</h3>
              <p className="muted">{service.service_id}</p>
              <p>{service.description}</p>
              <p>
                <strong>{service.price_usdt} USDT</strong>
              </p>
            </article>
          ))}
          {services.length === 0 && <p className="muted">No services yet. Register one from API first.</p>}
        </div>
      </section>

      <section className="panel">
        <h2>Create Order</h2>
        <label>
          Service
          <select value={serviceId} onChange={(event) => setServiceId(event.target.value)}>
            {services.map((service) => (
              <option key={service.service_id} value={service.service_id}>
                {service.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Buyer Wallet
          <input value={buyerWallet} onChange={(event) => setBuyerWallet(event.target.value)} />
        </label>
        <label>
          Input Payload JSON
          <textarea rows={5} value={inputJson} onChange={(event) => setInputJson(event.target.value)} />
        </label>
        <button disabled={loading || !selected} onClick={() => void createOrder()}>
          {loading ? 'Creating...' : 'Create Order'}
        </button>
      </section>

      <section className="panel">
        <h2>Order Query</h2>
        <label>
          Order ID
          <input value={orderIdQuery} onChange={(event) => setOrderIdQuery(event.target.value)} />
        </label>
        <button onClick={() => void fetchOrder(orderIdQuery)}>Refresh Order</button>
      </section>

      {lastOrder && (
        <section className="panel">
          <h2>Order Snapshot</h2>
          <p>
            <strong>ID:</strong> {lastOrder.order_id}
          </p>
          <p>
            <strong>Service:</strong> {lastOrder.service_id}
          </p>
          <p>
            <strong>Status:</strong> <span className={`status ${lastOrder.status}`}>{lastOrder.status}</span>
          </p>
          <p>
            <strong>Tx Hash:</strong> {lastOrder.tx_hash ?? 'N/A'}
          </p>
          <p>
            <strong>Error:</strong> {lastOrder.error_message ?? 'N/A'}
          </p>
          <pre>{JSON.stringify(lastOrder.result_payload, null, 2)}</pre>
        </section>
      )}
    </main>
  );
}
