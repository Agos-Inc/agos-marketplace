import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Claw Marketplace Demo',
  description: 'OpenClaw BSC-only demo panel'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
