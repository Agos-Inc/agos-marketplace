'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const navItems = [
  { href: '/', label: 'Marketplace' },
  { href: '/orders', label: 'Orders' },
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
          <Image src="/agos-logo.jpeg" alt="AGOS logo" width={28} height={28} className="brand-logo" priority />
          <span className="brand-text">AGOS Marketplace</span>
        </Link>
        <nav className="tab-group">
          {navItems.map((item) => (
            <Link key={item.href} href={item.href} className={`tab ${isActive(pathname, item.href) ? 'tab-active' : ''}`}>
              {item.label}
            </Link>
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
