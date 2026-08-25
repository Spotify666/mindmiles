import type { Metadata, Viewport } from 'next';
import { Inter_Tight, JetBrains_Mono } from 'next/font/google';
import './globals.css';
import MindMilesProvider from '@/components/MindMilesProvider';
import TopBar from '@/components/nav/TopBar';
import { TabBar } from '@/components/nav/TabBar';

/**
 * Inter Tight for everything the user reads, JetBrains Mono for labels and axes.
 * Two families, and the second one only ever appears at 10–11px in uppercase —
 * enough to make a label read as an instrument marking rather than as prose.
 */
const sans = Inter_Tight({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
  weight: ['400', '500', '600', '700'],
});

const mono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  display: 'swap',
  weight: ['400', '500'],
});

export const metadata: Metadata = {
  title: {
    default: 'Mind Miles — Measure where your attention goes',
    template: '%s · Mind Miles',
  },
  description:
    'The digital fitness tracker for your mind. Mind Miles measures how you actually use your devices and turns it into focus, recovery, strain and reclaimed time — measured on your device, and never sent anywhere.',
  applicationName: 'Mind Miles',
  robots: { index: true, follow: true },
  openGraph: {
    title: 'Mind Miles',
    description: 'Measure where your attention goes.',
    type: 'website',
  },
  appleWebApp: { capable: true, title: 'Mind Miles', statusBarStyle: 'black-translucent' },
  manifest: '/manifest.webmanifest',
};

export const viewport: Viewport = {
  themeColor: '#08090C',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${sans.variable} ${mono.variable}`}>
      <body className="font-sans antialiased">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[80] focus:rounded-pill focus:bg-focus focus:px-4 focus:py-2 focus:text-sm focus:font-[620] focus:text-void"
        >
          Skip to content
        </a>
        <MindMilesProvider>
          <TopBar />
          {/* Bottom padding clears the mobile tab bar. */}
          <main id="main" className="safe-x mx-auto max-w-wide pb-28 pt-5 md:pb-16">
            {children}
          </main>
          <TabBar />
        </MindMilesProvider>
      </body>
    </html>
  );
}
