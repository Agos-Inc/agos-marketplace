'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { KpiStrip } from '../components/KpiStrip';
import { OrderTable } from '../components/OrderTable';
import { StatusBadge } from '../components/StatusBadge';
import { TopNav } from '../components/TopNav';
import { createPurchase, getApiBaseUrl, getOrder, listListings, listOrders, preparePayment } from '../lib/api';
import { byLatestUpdated, countOrders, formatTime, prettyJson, shortHex } from '../lib/format';
import type { Listing, Order, PaymentPreparation, Purchase } from '../lib/types';

type BusyState = 'creating' | 'preparing' | 'querying' | 'refreshing' | null;

const DEFAULT_BUYER_WALLET = '0xf120B79d02c56f9c123931F0c3a876a7ceef4116';

export default function HomePage() {
  const [listings, setListings] = useState<Listing[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [selectedListingId, setSelectedListingId] = useState<string>('');
  const [buyerWallet, setBuyerWallet] = useState<string>(DEFAULT_BUYER_WALLET);
  const [inputJson, setInputJson] = useState<string>('{"resource":"demo-task","priority":"high"}');
  const [latestPurchase, setLatestPurchase] = useState<Purchase | null>(null);
  const [paymentPreparation, setPaymentPreparation] = useState<PaymentPreparation | null>(null);
  const [queryOrderId, setQueryOrderId] = useState<string>('');
  const [focusOrder, setFocusOrder] = useState<Order | null>(null);
  const [busy, setBusy] = useState<BusyState>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState<boolean>(true);

  const sortedOrders = useMemo(() => [...orders].sort(byLatestUpdated), [orders]);
  const completedOrders = useMemo(() => sortedOrders.filter((order) => order.status === 'COMPLETED').slice(0, 6), [sortedOrders]);
  const counts = useMemo(() => countOrders(sortedOrders), [sortedOrders]);
  const selectedListing = useMemo(
    () => listings.find((listing) => listing.listing_id === selectedListingId) ?? null,
    [listings, selectedListingId]
  );

  async function refreshListings(): Promise<void> {
    const nextListings = await listListings();
    setListings(nextListings);

    if (nextListings.length > 0 && !nextListings.some((item) => item.listing_id === selectedListingId)) {
      setSelectedListingId(nextListings[0]!.listing_id);
    }
  }

  async function refreshOrders(): Promise<void> {
    const nextOrders = await listOrders();
    setOrders(nextOrders);
  }

  async function refreshDashboard(): Promise<void> {
    setBusy('refreshing');
    setErrorMessage(null);
    try {
      await Promise.all([refreshListings(), refreshOrders()]);
    } catch (error) {
      setErrorMessage((error as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function handleCreatePurchase(): Promise<void> {
    if (!selectedListing) {
      setErrorMessage('Please select an active listing first.');
      return;
    }

    setBusy('creating');
    setErrorMessage(null);
    try {
      const payload = JSON.parse(inputJson) as Record<string, unknown>;
      const purchase = await createPurchase({
        listing_id: selectedListing.listing_id,
        buyer_wallet: buyerWallet.trim(),
        input_payload: payload
      });
      setLatestPurchase(purchase);
      setQueryOrderId(purchase.purchase_id);
      setPaymentPreparation(null);
      await refreshOrders();
      const order = await getOrder(purchase.purchase_id);
      setFocusOrder(order);
    } catch (error) {
      setErrorMessage((error as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function handlePreparePayment(): Promise<void> {
    if (!latestPurchase) {
      return;
    }

    setBusy('preparing');
    setErrorMessage(null);
    try {
      const nextPreparation = await preparePayment(latestPurchase.purchase_id);
      setPaymentPreparation(nextPreparation);
    } catch (error) {
      setErrorMessage((error as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function handleQueryOrder(): Promise<void> {
    const trimmed = queryOrderId.trim();
    if (!trimmed) {
      return;
    }

    setBusy('querying');
    setErrorMessage(null);
    try {
      const order = await getOrder(trimmed);
      setFocusOrder(order);
    } catch (error) {
      setErrorMessage((error as Error).message);
    } finally {
      setBusy(null);
    }
  }

  useEffect(() => {
    void refreshDashboard();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!autoRefresh) {
      return;
    }

    const timer = setInterval(() => {
      void refreshOrders();
      if (focusOrder) {
        void getOrder(focusOrder.order_id).then(setFocusOrder).catch(() => undefined);
      }
    }, 5000);

    return () => clearInterval(timer);
  }, [autoRefresh, focusOrder]);

  return (
    <>
      <TopNav />
      <main className="shell page-space">
        <section className="hero-card">
          <div className="hero-glow hero-glow-right" />
          <div className="hero-glow hero-glow-left" />
          <div className="hero-content">
            <p className="eyebrow">OpenClaw · BSC · AGOS</p>
            <h1>Agent Resource Marketplace</h1>
            <p className="hero-text">
              Browse agent services, create purchases, prepare on-chain payment parameters, and track order settlement states
              in one panel.
            </p>
            <div className="hero-actions">
              <button className="btn btn-primary btn-sm" type="button" onClick={() => void refreshDashboard()}>
                {busy === 'refreshing' ? 'Refreshing...' : 'Refresh Data'}
              </button>
              <span className="api-pill">API: {getApiBaseUrl()}</span>
            </div>
          </div>
        </section>

        <KpiStrip counts={counts} />

        {errorMessage ? (
          <section className="card card-danger">
            <p className="card-title">Request Error</p>
            <p className="error-text">{errorMessage}</p>
          </section>
        ) : null}

        <section className="content-grid">
          <article className="card">
            <div className="section-head">
              <div>
                <p className="card-label">Listings</p>
                <h2 className="card-title">Active Resources</h2>
              </div>
            </div>
            <div className="listing-grid">
              {listings.map((listing) => {
                const selected = listing.listing_id === selectedListingId;
                return (
                  <button
                    type="button"
                    key={listing.listing_id}
                    className={`listing-card ${selected ? 'is-selected' : ''}`}
                    onClick={() => setSelectedListingId(listing.listing_id)}
                  >
                    <p className="listing-title">{listing.title}</p>
                    <p className="listing-sub">{listing.listing_id}</p>
                    <p className="listing-desc">{listing.description}</p>
                    <div className="listing-meta">
                      <span>{listing.price_usdt} USDT</span>
                      <span>{shortHex(listing.supplier_wallet, 8, 6)}</span>
                    </div>
                  </button>
                );
              })}
              {listings.length === 0 ? <p className="empty-hint">No active listings found.</p> : null}
            </div>
          </article>

          <article className="card">
            <p className="card-label">Create Purchase</p>
            <h2 className="card-title">Generate a New Order</h2>
            <label className="field">
              <span>Listing</span>
              <select value={selectedListingId} onChange={(event) => setSelectedListingId(event.target.value)}>
                <option value="">Select listing</option>
                {listings.map((listing) => (
                  <option key={listing.listing_id} value={listing.listing_id}>
                    {listing.title} · {listing.price_usdt} USDT
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Buyer Wallet</span>
              <input value={buyerWallet} onChange={(event) => setBuyerWallet(event.target.value)} />
            </label>
            <label className="field">
              <span>Input Payload (JSON)</span>
              <textarea rows={6} value={inputJson} onChange={(event) => setInputJson(event.target.value)} />
            </label>
            <div className="button-row">
              <button type="button" className="btn btn-primary" disabled={busy === 'creating'} onClick={() => void handleCreatePurchase()}>
                {busy === 'creating' ? 'Creating...' : 'Create Purchase'}
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                disabled={!latestPurchase || busy === 'preparing'}
                onClick={() => void handlePreparePayment()}
              >
                {busy === 'preparing' ? 'Preparing...' : 'Prepare Payment'}
              </button>
            </div>
            {latestPurchase ? (
              <div className="info-box">
                <p className="info-line">
                  <strong>Purchase:</strong> {latestPurchase.purchase_id}
                </p>
                <p className="info-line">
                  <strong>Status:</strong> <StatusBadge status={latestPurchase.status} />
                </p>
                <p className="info-line">
                  <strong>Amount:</strong> {latestPurchase.amount_usdt} USDT
                </p>
              </div>
            ) : null}
          </article>
        </section>

        <section className="content-grid">
          <article className="card card-span-2">
            <div className="section-head">
              <div>
                <p className="card-label">Orders</p>
                <h2 className="card-title">Live Order Board</h2>
              </div>
              <label className="toggle-field">
                <input type="checkbox" checked={autoRefresh} onChange={(event) => setAutoRefresh(event.target.checked)} />
                <span>Auto refresh</span>
              </label>
            </div>
            <OrderTable
              orders={sortedOrders}
              activeOrderId={focusOrder?.order_id}
              onSelectOrder={(order) => {
                setFocusOrder(order);
                setQueryOrderId(order.order_id);
              }}
            />
          </article>

          <article className="card">
            <p className="card-label">Order Inspector</p>
            <h2 className="card-title">Query by ID</h2>
            <div className="query-row">
              <input value={queryOrderId} onChange={(event) => setQueryOrderId(event.target.value)} placeholder="ord_..." />
              <button type="button" className="btn btn-secondary btn-sm" disabled={busy === 'querying'} onClick={() => void handleQueryOrder()}>
                {busy === 'querying' ? 'Loading...' : 'Load'}
              </button>
            </div>
            {focusOrder ? (
              <div className="info-box">
                <p className="info-line">
                  <strong>Order:</strong> {focusOrder.order_id}
                </p>
                <p className="info-line">
                  <strong>Status:</strong> <StatusBadge status={focusOrder.status} />
                </p>
                <p className="info-line">
                  <strong>Tx:</strong> {focusOrder.tx_hash ? shortHex(focusOrder.tx_hash, 12, 8) : 'Not paid'}
                </p>
                <p className="info-line">
                  <strong>Updated:</strong> {formatTime(focusOrder.updated_at)}
                </p>
                <div className="button-row">
                  <Link href={`/proof/${encodeURIComponent(focusOrder.order_id)}`} className="btn btn-secondary btn-sm">
                    Open Proof
                  </Link>
                </div>
              </div>
            ) : (
              <p className="empty-hint">Select an order to inspect full details.</p>
            )}
          </article>
        </section>

        <section className="content-grid">
          <article className="card">
            <p className="card-label">Payment Parameters</p>
            <h2 className="card-title">payForService Inputs</h2>
            {paymentPreparation ? (
              <pre>{prettyJson(paymentPreparation)}</pre>
            ) : (
              <p className="empty-hint">Create a purchase and click "Prepare Payment" to view chain params.</p>
            )}
          </article>
          <article className="card card-span-2">
            <p className="card-label">Completed Deals</p>
            <h2 className="card-title">Recent Settled Orders</h2>
            {completedOrders.length === 0 ? (
              <p className="empty-hint">No completed deals yet.</p>
            ) : (
              <div className="completed-grid">
                {completedOrders.map((order) => (
                  <Link key={order.order_id} href={`/proof/${encodeURIComponent(order.order_id)}`} className="completed-card">
                    <p className="cell-title">{order.order_id}</p>
                    <p className="cell-sub">{order.service_id}</p>
                    <div className="listing-meta">
                      <span>{order.amount_usdt} USDT</span>
                      <StatusBadge status={order.status} />
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </article>
        </section>
      </main>
    </>
  );
}
