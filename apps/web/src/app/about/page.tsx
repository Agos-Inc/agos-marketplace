'use client';

import { useState } from 'react';
import { TopNav } from '../../components/TopNav';

const INSTALL_COMMAND = 'Install "Agos Skill" from ClawHub';
const VERIFY_COMMAND = 'List AGOS listings and create a purchase';
const SKILL_FALLBACK_URL = 'https://market.agos.fun/skill.md';

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
          <h2>One Command to Install Agos Skill</h2>
          <p className="install-sub">
            Since the skill is already published, users can install by directly asking OpenClaw. This is the primary path.
          </p>

          <div className="command-box">
            <p className="command-title">Step 1 · Install</p>
            <p className="command-text">{INSTALL_COMMAND}</p>
            <button type="button" className="btn btn-primary btn-sm" onClick={() => void copyText('install', INSTALL_COMMAND)}>
              {copied === 'install' ? 'Copied' : 'Copy Command'}
            </button>
          </div>

          <div className="command-box">
            <p className="command-title">Step 2 · Verify</p>
            <p className="command-text">{VERIFY_COMMAND}</p>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => void copyText('verify', VERIFY_COMMAND)}>
              {copied === 'verify' ? 'Copied' : 'Copy Command'}
            </button>
          </div>

          <div className="command-box command-box-fallback">
            <p className="command-title">Fallback Skill URL</p>
            <p className="command-text">{SKILL_FALLBACK_URL}</p>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => void copyText('url', SKILL_FALLBACK_URL)}>
              {copied === 'url' ? 'Copied' : 'Copy URL'}
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
