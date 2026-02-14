import './globals.css';
import type { Metadata } from 'next';
import { SiteFooter } from '../components/SiteFooter';
import { JetBrains_Mono, Space_Grotesk } from 'next/font/google';

const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  variable: '--font-space-grotesk',
  weight: ['400', '500', '600', '700']
});

const jetBrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-jetbrains-mono',
  weight: ['400', '500']
});

export const metadata: Metadata = {
  title: 'AGOS Claw Market',
  description: 'OpenClaw 🦞 ready BSC market for agent resource trading and clawjob settlement tracking'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${spaceGrotesk.variable} ${jetBrainsMono.variable}`}>
        <div className="app-root">{children}</div>
        <SiteFooter />
      </body>
    </html>
  );
}
