'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { KpiStrip } from '../../components/KpiStrip';
import { OrderTable } from '../../components/OrderTable';
import { StatusBadge } from '../../components/StatusBadge';
import { TopNav } from '../../components/TopNav';
import { getOrder, listOrders } from '../../lib/api';
import { byLatestUpdated, countOrders, formatTime, prettyJson, shortHex } from '../../lib/format';
import { ORDER_STATES, type Order } from '../../lib/types';

type BusyState = 'refreshing' | 'loading-order' | null;

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [selectedState, setSelectedState] = useState<string>('ALL');
  const [queryOrderId, setQueryOrderId] = useState<string>('');
  const [focusOrder, setFocusOrder] = useState<Order | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState<BusyState>(null);

  const sortedOrders = useMemo(() => [...orders].sort(byLatestUpdated), [orders]);
  const filteredOrders = useMemo(
    () => sortedOrders.filter((order) => (selectedState === 'ALL' ? true : order.status === selectedState)),
    [selectedState, sortedOrders]
  );
  const counts = useMemo(() => countOrders(sortedOrders), [sortedOrders]);

  async function refreshOrders(): Promise<void> {
    setBusy('refreshing');
    setErrorMessage(null);
    try {
      const nextOrders = await listOrders();
      setOrders(nextOrders);
    } catch (error) {
      setErrorMessage((error as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function loadByQuery(): Promise<void> {
    const orderId = queryOrderId.trim();
    if (!orderId) {
      return;
    }

    setBusy('loading-order');
    setErrorMessage(null);
    try {
      const order = await getOrder(orderId);
      setFocusOrder(order);
    } catch (error) {
      setErrorMessage((error as Error).message);
    } finally {
      setBusy(null);
    }
  }

  useEffect(() => {
    void refreshOrders();
  }, []);

  return (
    <>
      <TopNav />
      <main className="shell page-space">
        <section className="hero-card hero-card-compact">
          <div className="hero-content">
            <p className="eyebrow">Operations</p>
            <h1>ClawJob Dashboard</h1>
            <p className="hero-text">Track the full lifecycle from CREATED to COMPLETED and inspect payment evidence.</p>
          </div>
          <div className="hero-actions">
            <button className="btn btn-primary btn-sm" type="button" onClick={() => void refreshOrders()}>
              {busy === 'refreshing' ? 'Refreshing...' : 'Refresh ClawJobs'}
            </button>
          </div>
        </section>

        <KpiStrip counts={counts} />

        {errorMessage ? (
          <section className="card card-danger">
            <p className="card-title">Request Error</p>
            <p className="error-text">{errorMessage}</p>
          </section>
        ) : null}

        <section className="card">
          <div className="section-head">
            <div>
              <p className="card-label">Filters</p>
              <h2 className="card-title">Status Scope</h2>
            </div>
            <div className="tab-group wrap">
              <button type="button" className={`tab ${selectedState === 'ALL' ? 'tab-active' : ''}`} onClick={() => setSelectedState('ALL')}>
                ALL
              </button>
              {ORDER_STATES.map((state) => (
                <button type="button" key={state} className={`tab ${selectedState === state ? 'tab-active' : ''}`} onClick={() => setSelectedState(state)}>
                  {state}
                </button>
              ))}
            </div>
          </div>
          <OrderTable
            orders={filteredOrders}
            activeOrderId={focusOrder?.order_id}
            onSelectOrder={(order) => {
              setFocusOrder(order);
              setQueryOrderId(order.order_id);
            }}
          />
        </section>

        <section className="content-grid">
          <article className="card">
            <p className="card-label">Find ClawJob</p>
            <h2 className="card-title">Direct Query</h2>
            <div className="query-row">
              <input value={queryOrderId} onChange={(event) => setQueryOrderId(event.target.value)} placeholder="ord_..." />
              <button className="btn btn-secondary btn-sm" type="button" disabled={busy === 'loading-order'} onClick={() => void loadByQuery()}>
                {busy === 'loading-order' ? 'Loading...' : 'Load'}
              </button>
            </div>
            <p className="empty-hint">Use exact clawjob id from API or table selection.</p>
          </article>

          <article className="card card-span-2">
            <p className="card-label">ClawJob Detail</p>
            <h2 className="card-title">Focused Record</h2>
            {focusOrder ? (
              <div className="order-detail-grid">
                <div>
                  <p className="meta-label">ClawJob ID</p>
                  <p>{focusOrder.order_id}</p>
                </div>
                <div>
                  <p className="meta-label">Status</p>
                  <StatusBadge status={focusOrder.status} />
                </div>
                <div>
                  <p className="meta-label">Buyer</p>
                  <p title={focusOrder.buyer_wallet}>{shortHex(focusOrder.buyer_wallet, 12, 8)}</p>
                </div>
                <div>
                  <p className="meta-label">Supplier</p>
                  <p title={focusOrder.supplier_wallet}>{shortHex(focusOrder.supplier_wallet, 12, 8)}</p>
                </div>
                <div>
                  <p className="meta-label">Amount</p>
                  <p>{focusOrder.amount_usdt} USDT</p>
                </div>
                <div>
                  <p className="meta-label">Updated</p>
                  <p>{formatTime(focusOrder.updated_at)}</p>
                </div>
                <div className="detail-span">
                  <p className="meta-label">Input Payload</p>
                  <pre>{prettyJson(focusOrder.input_payload)}</pre>
                </div>
                {focusOrder.result_payload ? (
                  <div className="detail-span">
                    <p className="meta-label">Result Payload</p>
                    <pre>{prettyJson(focusOrder.result_payload)}</pre>
                  </div>
                ) : null}
                {focusOrder.error_message ? (
                  <div className="detail-span">
                    <p className="meta-label">Error</p>
                    <p className="error-text">{focusOrder.error_message}</p>
                  </div>
                ) : null}
                <div className="button-row detail-span">
                  <Link href={`/proof/${encodeURIComponent(focusOrder.order_id)}`} className="btn btn-secondary btn-sm">
                    View Proof Page
                  </Link>
                </div>
              </div>
            ) : (
              <p className="empty-hint">Select a clawjob to inspect details.</p>
            )}
          </article>
        </section>
      </main>
    </>
  );
}
