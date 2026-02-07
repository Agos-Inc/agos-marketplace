'use client';

import { useEffect, useMemo, useState } from 'react';

type Listing = {
  listing_id: string;
  listing_id_hex: string;
  title: string;
  description: string;
  price_usdt: string;
  supplier_wallet: string;
  is_active: boolean;
};

type Order = {
  order_id: string;
  order_id_hex: string;
  service_id: string;
  status: string;
  buyer_wallet: string;
  supplier_wallet: string;
  amount_usdt: string;
  tx_hash: string | null;
  error_message: string | null;
  result_payload: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
};

type Purchase = {
  purchase_id: string;
  listing_id: string;
  status: string;
  amount_usdt: string;
  tx_hash: string | null;
  created_at: string;
};

type PaymentPreparation = {
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

const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:3000';

function shorten(value: string, head = 6, tail = 4): string {
  if (value.length <= head + tail + 2) {
    return value;
  }
  return `${value.slice(0, head)}...${value.slice(-tail)}`;
}

function fmtTime(input: string): string {
  const date = new Date(input);
  if (Number.isNaN(date.getTime())) {
    return input;
  }
  return date.toLocaleString();
}

async function parseError(response: Response): Promise<string> {
  const text = await response.text();
  if (!text) {
    return `request failed (${response.status})`;
  }
  try {
    const json = JSON.parse(text) as { message?: string };
    return json.message ?? text;
  } catch {
    return text;
  }
}

export default function Page() {
  const [listings, setListings] = useState<Listing[]>([]);
  const [selectedListingId, setSelectedListingId] = useState('');
  const [buyerWallet, setBuyerWallet] = useState('0x0000000000000000000000000000000000000002');
  const [inputJson, setInputJson] = useState('{"topic":"Market trend report"}');

  const [orders, setOrders] = useState<Order[]>([]);
  const [focusOrder, setFocusOrder] = useState<Order | null>(null);
  const [orderIdQuery, setOrderIdQuery] = useState('');

  const [latestPurchase, setLatestPurchase] = useState<Purchase | null>(null);
  const [paymentPreparation, setPaymentPreparation] = useState<PaymentPreparation | null>(null);

  const [autoRefresh, setAutoRefresh] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const selectedListing = useMemo(
    () => listings.find((listing) => listing.listing_id === selectedListingId),
    [listings, selectedListingId]
  );

  const sortedOrders = useMemo(
    () => [...orders].sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()),
    [orders]
  );

  const completedOrders = useMemo(() => sortedOrders.filter((order) => order.status === 'COMPLETED'), [sortedOrders]);

  const counts = useMemo(() => {
    return {
      all: sortedOrders.length,
      paid: sortedOrders.filter((order) => order.status === 'PAID').length,
      running: sortedOrders.filter((order) => order.status === 'RUNNING').length,
      completed: sortedOrders.filter((order) => order.status === 'COMPLETED').length,
      failed: sortedOrders.filter((order) => order.status === 'FAILED').length
    };
  }, [sortedOrders]);

  async function loadListings(): Promise<void> {
    try {
      const response = await fetch(`${apiBase}/v1/openclaw/listings`);
      if (!response.ok) {
        throw new Error(await parseError(response));
      }
      const data = (await response.json()) as Listing[];
      setListings(data.filter((item) => item.is_active));
      if (!selectedListingId) {
        const first = data.find((item) => item.is_active);
        if (first) {
          setSelectedListingId(first.listing_id);
        }
      }
    } catch (error) {
      setErrorMessage((error as Error).message);
    }
  }

  async function loadOrders(): Promise<void> {
    try {
      const response = await fetch(`${apiBase}/v1/orders`);
      if (!response.ok) {
        throw new Error(await parseError(response));
      }
      const data = (await response.json()) as Order[];
      setOrders(data);
    } catch (error) {
      setErrorMessage((error as Error).message);
    }
  }

  async function createPurchase(): Promise<void> {
    if (!selectedListing) {
      return;
    }

    setBusy('create');
    setErrorMessage(null);

    try {
      const payload = JSON.parse(inputJson) as Record<string, unknown>;
      const response = await fetch(`${apiBase}/v1/openclaw/purchases`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          listing_id: selectedListing.listing_id,
          buyer_wallet: buyerWallet,
          input_payload: payload
        })
      });

      if (!response.ok) {
        throw new Error(await parseError(response));
      }

      const purchase = (await response.json()) as Purchase;
      setLatestPurchase(purchase);
      setOrderIdQuery(purchase.purchase_id);
      await Promise.all([loadOrders(), fetchOrder(purchase.purchase_id)]);
    } catch (error) {
      setErrorMessage((error as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function fetchOrder(orderId: string): Promise<void> {
    if (!orderId) {
      return;
    }

    setBusy('query');
    setErrorMessage(null);

    try {
      const response = await fetch(`${apiBase}/v1/orders/${orderId}`);
      if (!response.ok) {
        throw new Error(await parseError(response));
      }
      const order = (await response.json()) as Order;
      setFocusOrder(order);
    } catch (error) {
      setErrorMessage((error as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function preparePayment(): Promise<void> {
    if (!latestPurchase) {
      return;
    }

    setBusy('prepare');
    setErrorMessage(null);

    try {
      const response = await fetch(`${apiBase}/v1/openclaw/purchases/${latestPurchase.purchase_id}/prepare-payment`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: '{}'
      });

      if (!response.ok) {
        throw new Error(await parseError(response));
      }

      const data = (await response.json()) as PaymentPreparation;
      setPaymentPreparation(data);
    } catch (error) {
      setErrorMessage((error as Error).message);
    } finally {
      setBusy(null);
    }
  }

  useEffect(() => {
    void loadListings();
    void loadOrders();
  }, []);

  useEffect(() => {
    if (!autoRefresh) {
      return;
    }

    const timer = setInterval(() => {
      void loadOrders();
      if (focusOrder) {
        void fetchOrder(focusOrder.order_id);
      }
    }, 4_000);

    return () => clearInterval(timer);
  }, [autoRefresh, focusOrder?.order_id]);

  return (
    <main className="app-shell">
      <header className="hero panel">
        <h1>AGOS Marketplace Demo</h1>
        <p className="muted">
          OpenClaw-ready BNB Chain demo for listing resources, creating purchases, tracking order states, and viewing completed
          deals.
        </p>
      </header>

      <section className="panel kpi-grid">
        <article>
          <p className="kpi-label">All Orders</p>
          <p className="kpi-value">{counts.all}</p>
        </article>
        <article>
          <p className="kpi-label">Paid</p>
          <p className="kpi-value">{counts.paid}</p>
        </article>
        <article>
          <p className="kpi-label">Running</p>
          <p className="kpi-value">{counts.running}</p>
        </article>
        <article>
          <p className="kpi-label">Completed Deals</p>
          <p className="kpi-value">{counts.completed}</p>
        </article>
        <article>
          <p className="kpi-label">Failed</p>
          <p className="kpi-value">{counts.failed}</p>
        </article>
      </section>

      <section className="panel">
        <div className="section-head">
          <h2>Listings</h2>
          <button type="button" onClick={() => void loadListings()}>
            Refresh Listings
          </button>
        </div>

        <div className="grid cards">
          {listings.map((listing) => (
            <article
              key={listing.listing_id}
              className={`card ${selectedListingId === listing.listing_id ? 'card-selected' : ''}`}
              onClick={() => setSelectedListingId(listing.listing_id)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  setSelectedListingId(listing.listing_id);
                }
              }}
              role="button"
              tabIndex={0}
            >
              <h3>{listing.title}</h3>
              <p className="muted">{listing.listing_id}</p>
              <p>{listing.description}</p>
              <p className="price">{listing.price_usdt} USDT</p>
              <p className="muted">Supplier: {shorten(listing.supplier_wallet, 10, 6)}</p>
            </article>
          ))}
          {listings.length === 0 && <p className="muted">No active listing found. Register one from API first.</p>}
        </div>
      </section>

      <section className="panel">
        <h2>Create Purchase</h2>
        <label>
          Selected Listing
          <select value={selectedListingId} onChange={(event) => setSelectedListingId(event.target.value)}>
            {listings.map((listing) => (
              <option key={listing.listing_id} value={listing.listing_id}>
                {listing.title} ({listing.price_usdt} USDT)
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

        <div className="actions">
          <button type="button" disabled={busy === 'create' || !selectedListingId} onClick={() => void createPurchase()}>
            {busy === 'create' ? 'Creating...' : 'Create Purchase'}
          </button>
          <button type="button" disabled={!latestPurchase || busy === 'prepare'} onClick={() => void preparePayment()}>
            {busy === 'prepare' ? 'Preparing...' : 'Prepare Payment Params'}
          </button>
        </div>

        {latestPurchase && (
          <div className="result-block">
            <p>
              <strong>Latest Purchase:</strong> {latestPurchase.purchase_id}
            </p>
            <p>
              <strong>Status:</strong> <span className={`status ${latestPurchase.status}`}>{latestPurchase.status}</span>
            </p>
            <p>
              <strong>Amount:</strong> {latestPurchase.amount_usdt} USDT
            </p>
            <p>
              <strong>Created:</strong> {fmtTime(latestPurchase.created_at)}
            </p>
            <button type="button" onClick={() => void fetchOrder(latestPurchase.purchase_id)}>
              Track This Purchase
            </button>
          </div>
        )}

        {paymentPreparation && (
          <div className="result-block">
            <h3>Payment Parameters (for payForService)</h3>
            <pre>{JSON.stringify(paymentPreparation, null, 2)}</pre>
          </div>
        )}
      </section>

      <section className="panel">
        <div className="section-head">
          <h2>Order Status Board</h2>
          <div className="toolbar">
            <label className="toggle">
              <input type="checkbox" checked={autoRefresh} onChange={(event) => setAutoRefresh(event.target.checked)} />
              Auto refresh (4s)
            </label>
            <button type="button" onClick={() => void loadOrders()}>
              Refresh Orders
            </button>
          </div>
        </div>

        <div className="query-line">
          <input
            placeholder="Query by order id"
            value={orderIdQuery}
            onChange={(event) => setOrderIdQuery(event.target.value)}
          />
          <button type="button" disabled={busy === 'query' || !orderIdQuery} onClick={() => void fetchOrder(orderIdQuery)}>
            {busy === 'query' ? 'Querying...' : 'Query Order'}
          </button>
        </div>

        <div className="list-table">
          <div className="list-row list-head">
            <span>Order</span>
            <span>Listing</span>
            <span>Status</span>
            <span>Amount</span>
            <span>Updated</span>
            <span>Tx</span>
          </div>
          {sortedOrders.slice(0, 12).map((order) => (
            <button
              key={order.order_id}
              className="list-row list-btn"
              type="button"
              onClick={() => void fetchOrder(order.order_id)}
            >
              <span>{shorten(order.order_id, 14, 4)}</span>
              <span>{shorten(order.service_id, 14, 4)}</span>
              <span>
                <span className={`status ${order.status}`}>{order.status}</span>
              </span>
              <span>{order.amount_usdt} USDT</span>
              <span>{fmtTime(order.updated_at)}</span>
              <span>
                {order.tx_hash ? (
                  <a
                    href={`https://bscscan.com/tx/${order.tx_hash}`}
                    target="_blank"
                    rel="noreferrer"
                    onClick={(event) => event.stopPropagation()}
                  >
                    {shorten(order.tx_hash, 10, 8)}
                  </a>
                ) : (
                  'N/A'
                )}
              </span>
            </button>
          ))}
          {sortedOrders.length === 0 && <p className="muted">No orders yet.</p>}
        </div>
      </section>

      <section className="panel">
        <h2>Completed Deals</h2>
        <div className="grid cards">
          {completedOrders.slice(0, 6).map((deal) => (
            <article key={deal.order_id} className="card deal">
              <p>
                <strong>Order:</strong> {deal.order_id}
              </p>
              <p>
                <strong>Listing:</strong> {deal.service_id}
              </p>
              <p>
                <strong>Status:</strong> <span className={`status ${deal.status}`}>{deal.status}</span>
              </p>
              <p>
                <strong>Updated:</strong> {fmtTime(deal.updated_at)}
              </p>
              <pre>{JSON.stringify(deal.result_payload ?? { message: 'No payload' }, null, 2)}</pre>
            </article>
          ))}
          {completedOrders.length === 0 && <p className="muted">No completed deals yet. Complete a purchase to show settlement.</p>}
        </div>
      </section>

      {focusOrder && (
        <section className="panel">
          <h2>Focused Order Snapshot</h2>
          <pre>{JSON.stringify(focusOrder, null, 2)}</pre>
        </section>
      )}

      {errorMessage && (
        <section className="panel error-box">
          <strong>Request Error:</strong> {errorMessage}
        </section>
      )}
    </main>
  );
}
