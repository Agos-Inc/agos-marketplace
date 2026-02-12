'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { StatusBadge } from '../../../components/StatusBadge';
import { TopNav } from '../../../components/TopNav';
import { getOrder, preparePayment } from '../../../lib/api';
import { formatTime, shortHex } from '../../../lib/format';
import type { Order, PaymentPreparation } from '../../../lib/types';

export default function ProofPage() {
  const params = useParams<{ orderId: string }>();
  const [orderId, setOrderId] = useState<string>('');
  const [order, setOrder] = useState<Order | null>(null);
  const [paymentPreparation, setPaymentPreparation] = useState<PaymentPreparation | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const bscScanTxUrl = useMemo(() => {
    if (!order?.tx_hash) {
      return null;
    }
    return `https://bscscan.com/tx/${order.tx_hash}`;
  }, [order?.tx_hash]);

  useEffect(() => {
    if (params.orderId) {
      setOrderId(decodeURIComponent(params.orderId));
    }
  }, [params]);

  useEffect(() => {
    if (!orderId) {
      return;
    }

    async function load(): Promise<void> {
      setLoading(true);
      setErrorMessage(null);

      try {
        const nextOrder = await getOrder(orderId);
        setOrder(nextOrder);
        try {
          const payment = await preparePayment(orderId);
          setPaymentPreparation(payment);
        } catch {
          setPaymentPreparation(null);
        }
      } catch (error) {
        setErrorMessage((error as Error).message);
      } finally {
        setLoading(false);
      }
    }

    void load();
  }, [orderId]);

  return (
    <>
      <TopNav />
      <main className="shell page-space">
        <section className="hero-card hero-card-compact">
          <div className="hero-content">
            <p className="eyebrow">Chain Evidence</p>
            <h1>Payment Proof</h1>
            <p className="hero-text">Cross-check order fields with payment parameters and transaction status on BSC.</p>
          </div>
        </section>

        {loading ? (
          <section className="card">
            <p className="card-title">Loading proof...</p>
          </section>
        ) : null}

        {errorMessage ? (
          <section className="card card-danger">
            <p className="card-title">Load Error</p>
            <p className="error-text">{errorMessage}</p>
            <div className="button-row">
              <Link href="/orders" className="btn btn-secondary btn-sm">
                Back to Orders
              </Link>
            </div>
          </section>
        ) : null}

        {!loading && !errorMessage && order ? (
          <>
            <section className="card">
              <div className="section-head">
                <div>
                  <p className="card-label">Order</p>
                  <h2 className="card-title">{order.order_id}</h2>
                </div>
                <StatusBadge status={order.status} />
              </div>
              <div className="order-detail-grid">
                <div>
                  <p className="meta-label">Order ID Hex</p>
                  <p className="detail-value-code">{order.order_id_hex}</p>
                </div>
                <div>
                  <p className="meta-label">Listing ID</p>
                  <p className="detail-value">{order.service_id}</p>
                </div>
                <div>
                  <p className="meta-label">Listing ID Hex</p>
                  <p className="detail-value-code">{order.service_id_hex}</p>
                </div>
                <div>
                  <p className="meta-label">Buyer Wallet</p>
                  <p className="detail-value-code" title={order.buyer_wallet}>
                    {shortHex(order.buyer_wallet, 12, 8)}
                  </p>
                </div>
                <div>
                  <p className="meta-label">Supplier Wallet</p>
                  <p className="detail-value-code" title={order.supplier_wallet}>
                    {shortHex(order.supplier_wallet, 12, 8)}
                  </p>
                </div>
                <div>
                  <p className="meta-label">Amount</p>
                  <p className="detail-value">
                    {order.amount_usdt} USDT ({order.amount_atomic} atomic)
                  </p>
                </div>
                <div>
                  <p className="meta-label">Token Address</p>
                  <p className="detail-value-code">{order.token_address}</p>
                </div>
                <div>
                  <p className="meta-label">Chain ID</p>
                  <p className="detail-value">{order.chain_id}</p>
                </div>
                <div>
                  <p className="meta-label">Updated At</p>
                  <p className="detail-value">{formatTime(order.updated_at)}</p>
                </div>
                <div className="detail-span">
                  <p className="meta-label">Transaction Hash</p>
                  <p className="detail-value-code">{order.tx_hash ?? 'Waiting for on-chain payment event'}</p>
                </div>
                {bscScanTxUrl ? (
                  <div className="detail-span">
                    <div className="button-row">
                      <a className="btn btn-secondary btn-sm" href={bscScanTxUrl} target="_blank" rel="noreferrer">
                        Open in BscScan
                      </a>
                    </div>
                  </div>
                ) : null}
              </div>
            </section>

            <section className="card">
              <p className="card-label">Settlement Parameters</p>
              <h2 className="card-title">payForService Expected Values</h2>
              {paymentPreparation ? (
                <div className="order-detail-grid">
                  <div>
                    <p className="meta-label">Purchase ID</p>
                    <p className="detail-value">{paymentPreparation.purchase_id}</p>
                  </div>
                  <div>
                    <p className="meta-label">Purchase ID Hex</p>
                    <p className="detail-value-code">{paymentPreparation.purchase_id_hex}</p>
                  </div>
                  <div>
                    <p className="meta-label">Listing ID Hex</p>
                    <p className="detail-value-code">{paymentPreparation.listing_id_hex}</p>
                  </div>
                  <div>
                    <p className="meta-label">Router</p>
                    <p className="detail-value-code">{paymentPreparation.payment_router_address}</p>
                  </div>
                  <div>
                    <p className="meta-label">Token</p>
                    <p className="detail-value-code">{paymentPreparation.token_address}</p>
                  </div>
                  <div>
                    <p className="meta-label">Amount Atomic</p>
                    <p className="detail-value-code">{paymentPreparation.amount_atomic}</p>
                  </div>
                  <div>
                    <p className="meta-label">Supplier</p>
                    <p className="detail-value-code">{paymentPreparation.supplier_wallet}</p>
                  </div>
                  <div>
                    <p className="meta-label">Chain</p>
                    <p className="detail-value">{paymentPreparation.chain_id}</p>
                  </div>
                </div>
              ) : (
                <p className="empty-hint">Payment preparation data is unavailable for this order.</p>
              )}
            </section>
          </>
        ) : null}
      </main>
    </>
  );
}
