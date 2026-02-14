'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

type NavItem = {
  href: string;
  label: string;
  external?: boolean;
};

const navItems: NavItem[] = [
  { href: 'https://agos.fun/', label: 'AGOS.fun', external: true },
  { href: '/', label: 'Marketplace' },
  { href: '/orders', label: 'ClawJobs' },
  { href: '/about', label: 'About' }
];

function isActive(pathname: string, href: string): boolean {
  if (href === '/') {
    return pathname === href;
  }
  return pathname.startsWith(href);
}

export function TopNav() {
  const pathname = usePathname();

  return (
    <header className="top-nav-wrap">
      <div className="top-nav shell">
        <Link href="/" className="brand-link">
          <Image src="/agos-logo.jpeg" alt="AGOS logo" width={28} height={28} className="brand-logo" priority unoptimized />
          <span className="brand-text">AGOS ClawJob Market</span>
        </Link>
        <nav className="tab-group wrap top-nav-links">
          {navItems.map((item) => (
            item.external ? (
              <a key={item.href} href={item.href} className="tab" target="_blank" rel="noreferrer">
                {item.label}
              </a>
            ) : (
              <Link key={item.href} href={item.href} className={`tab ${isActive(pathname, item.href) ? 'tab-active' : ''}`}>
                {item.label}
              </Link>
            )
          ))}
        </nav>
        <div className="network-pill">
          <span className="network-ping" />
          <span>BSC Mainnet</span>
        </div>
      </div>
    </header>
  );
}
