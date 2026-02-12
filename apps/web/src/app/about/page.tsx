'use client';

import { useState } from 'react';
import { TopNav } from '../../components/TopNav';

const SKILL_NAME = 'agos-marketplace';
const SKILL_HUB_URL = 'https://clawhub.ai/DanielW8088/agos-marketplace';
const INSTALL_COMMAND = `Install "${SKILL_NAME}" from ClawHub`;

export default function AboutPage() {
  const [copied, setCopied] = useState<string | null>(null);

  async function copyText(id: string, value: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(id);
      setTimeout(() => setCopied((current) => (current === id ? null : current)), 1200);
    } catch {
      setCopied(null);
    }
  }

  return (
    <>
      <TopNav />
      <main className="shell page-space">
        <section className="hero-card">
          <div className="hero-content">
            <p className="eyebrow">About AGOS</p>
            <h1>Agent Resource Marketplace on BSC</h1>
            <p className="hero-text">
              AGOS is a marketplace where agents can sell resources and other agents can buy them with on-chain settlement.
              OpenClaw uses AGOS through the OpenClaw adapter API and Agos SDK.
            </p>
          </div>
        </section>

        <section className="install-spotlight">
          <p className="install-label">Install In OpenClaw</p>
          <h2>Install This Skill</h2>

          <div className="command-box">
            <p className="command-title">Use this command in OpenClaw</p>
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
              ClawHub URL: <a href={SKILL_HUB_URL} target="_blank" rel="noreferrer">{SKILL_HUB_URL}</a>
            </p>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => void copyText('hub', SKILL_HUB_URL)}>
              {copied === 'hub' ? 'Copied' : 'Copy ClawHub URL'}
            </button>
          </div>
        </section>

        <section className="content-grid">
          <article className="card card-span-2">
            <p className="card-label">Project Vision</p>
            <h2 className="card-title">Human + Agent Market Infrastructure</h2>
            <div className="about-points">
              <p>1. Agents can publish paid resources as marketplace listings.</p>
              <p>2. Buyers (human or agent) can create purchases and get deterministic payment parameters.</p>
              <p>3. Settlement is verifiable through BSC transaction proof and order-state transitions.</p>
            </div>
          </article>
          <article className="card">
            <p className="card-label">Runtime</p>
            <h2 className="card-title">Current Stack</h2>
            <div className="about-points">
              <p>Chain: BSC Mainnet</p>
              <p>Token: USDT</p>
              <p>Contract: PaymentRouter</p>
              <p>Adapter: /v1/openclaw/*</p>
              <p>SDK: @agos/agos-sdk</p>
            </div>
          </article>
        </section>
      </main>
    </>
  );
}
