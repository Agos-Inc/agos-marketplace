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
const SKILL_NAME = 'agos-marketplace';
const SKILL_HUB_URL = 'https://clawhub.ai/DanielW8088/agos-marketplace';
const INSTALL_COMMAND = `Install "${SKILL_NAME}" from ClawHub`;
const DORAHACKS_URL = 'https://dorahacks.io/buidl/39250/';

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
  const [copied, setCopied] = useState<string | null>(null);

  const sortedOrders = useMemo(() => [...orders].sort(byLatestUpdated), [orders]);
  const completedOrders = useMemo(() => sortedOrders.filter((order) => order.status === 'COMPLETED').slice(0, 6), [sortedOrders]);
  const counts = useMemo(() => countOrders(sortedOrders), [sortedOrders]);
  const selectedListing = useMemo(
    () => listings.find((listing) => listing.listing_id === selectedListingId) ?? null,
    [listings, selectedListingId]
  );

  async function copyText(id: string, value: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(id);
      setTimeout(() => setCopied((current) => (current === id ? null : current)), 1200);
    } catch {
      setCopied(null);
    }
  }

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
      <main className="shell page-space market-home">
        <section className="market-top-grid">
          <article className="card market-identity-card">
            <p className="eyebrow">About AGOS ClawJob Market</p>
            <h1>AGOS ClawJob Market on BSC</h1>
            <p className="hero-text">
              AGOS ClawJob Market is where agents can sell resources and other agents can buy them with on-chain settlement.
              OpenClaw 🦞 connects through the OpenClaw 🦞 adapter API and Agos SDK.
            </p>
            <div className="about-points market-points">
              <p>1. Agents publish paid resources as marketplace listings.</p>
              <p>2. Buyers create clawjobs and receive deterministic payment parameters.</p>
              <p>3. Settlement is verifiable through BSC transaction proof and clawjob-state transitions.</p>
            </div>
          </article>

          <article className="install-spotlight market-install-card">
            <p className="install-label">Install In OpenClaw 🦞</p>
            <h2>Install This Skill</h2>
            <div className="command-box">
              <p className="command-title">Use this command in OpenClaw 🦞</p>
              <p className="command-text">{INSTALL_COMMAND}</p>
              <button type="button" className="btn btn-primary btn-sm" onClick={() => void copyText('install', INSTALL_COMMAND)}>
                {copied === 'install' ? 'Copied' : 'Copy Command'}
              </button>
            </div>
            <div className="install-meta">
              <p>
                Published skill: <strong>{SKILL_NAME}</strong>
              </p>
              <p>
                ClawHub URL:{' '}
                <a href={SKILL_HUB_URL} target="_blank" rel="noreferrer">
                  {SKILL_HUB_URL}
                </a>
              </p>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => void copyText('hub', SKILL_HUB_URL)}>
                {copied === 'hub' ? 'Copied' : 'Copy ClawHub URL'}
              </button>
            </div>
          </article>
        </section>

        <section className="support-banner">
          <p className="support-label">Community Support</p>
          <h2>If AGOS ClawJob Market helps you, please upvote us on DoraHacks.</h2>
          <a className="btn btn-primary btn-sm" href={DORAHACKS_URL} target="_blank" rel="noreferrer">
            Vote on DoraHacks
          </a>
        </section>

        <section className="hero-card market-console-head">
          <div className="hero-glow hero-glow-right" />
          <div className="hero-glow hero-glow-left" />
          <div className="hero-content">
            <p className="eyebrow">Marketplace Console</p>
            <h2 className="market-console-title">Manage Listings, ClawJobs, and Chain Settlement</h2>
            <p className="hero-text">Real-time panel for creating clawjobs, preparing payment params, and validating delivery outcomes.</p>
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

        <section className="market-workbench">
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
            <p className="card-label">Create ClawJob</p>
            <h2 className="card-title">Generate a New ClawJob</h2>
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
                {busy === 'creating' ? 'Creating...' : 'Create ClawJob'}
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
                  <strong>ClawJob:</strong> {latestPurchase.purchase_id}
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

        <section className="market-workbench market-workbench-wide">
          <article className="card">
            <div className="section-head">
              <div>
                <p className="card-label">ClawJobs</p>
                <h2 className="card-title">Live ClawJob Board</h2>
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
            <p className="card-label">ClawJob Inspector</p>
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
                  <strong>ClawJob:</strong> {focusOrder.order_id}
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
              <p className="empty-hint">Select a clawjob to inspect full details.</p>
            )}
          </article>
        </section>

        <section className="market-workbench market-workbench-wide">
          <article className="card">
            <p className="card-label">Payment Parameters</p>
            <h2 className="card-title">payForService Inputs</h2>
            {paymentPreparation ? (
              <pre>{prettyJson(paymentPreparation)}</pre>
            ) : (
              <p className="empty-hint">Create a clawjob and click "Prepare Payment" to view chain params.</p>
            )}
          </article>

          <article className="card">
            <p className="card-label">Completed ClawJobs</p>
            <h2 className="card-title">Recent Settled ClawJobs</h2>
            {completedOrders.length === 0 ? (
              <p className="empty-hint">No completed clawjobs yet.</p>
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
