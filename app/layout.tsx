import type { Metadata, Viewport } from 'next';
import { Inter_Tight, JetBrains_Mono } from 'next/font/google';
import './globals.css';
import MindMilesProvider from '@/components/MindMilesProvider';
import Splash from '@/components/Splash';
import ServiceWorker from '@/components/ServiceWorker';
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
      <head>
        {/*
          Runs before first paint. The opening plays once per browser session,
          and deciding that in an effect would show a frame of it on every
          subsequent load — so the class is stamped here and CSS hides the
          overlay before anything is painted.
        */}
        {/*
          `beforeinstallprompt` frequently fires before React has hydrated, and
          it cannot be recovered once missed — so it is caught here and parked on
          window for lib/mm/install to read.
        */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              `window.addEventListener('beforeinstallprompt',function(e){` +
              `e.preventDefault();window.__mmInstallEvent=e;` +
              `window.dispatchEvent(new Event('mm:installable'))});` +
              `window.addEventListener('appinstalled',function(){` +
              `window.__mmInstalled=true;window.__mmInstallEvent=null});`,
          }}
        />
        <script
          dangerouslySetInnerHTML={{
            __html:
              `try{` +
              // Already played this session.
              `var seen=sessionStorage.getItem('mindmiles.splash.seen')==='1';` +
              // A first-time visitor goes straight to the welcome. The welcome IS
              // the entrance; putting a 2.5s title card in front of it just hides
              // the one screen that explains what this is.
              `var raw=localStorage.getItem('mindmiles.v1');` +
              `var first=true;try{first=!raw||JSON.parse(raw).onboarded!==true}catch(e){}` +
              `if(seen||first){document.documentElement.classList.add('splash-skip')}` +
              `}catch(e){}`,
          }}
        />
      </head>
      <body className="font-sans antialiased">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[80] focus:rounded-pill focus:bg-focus focus:px-4 focus:py-2 focus:text-sm focus:font-[620] focus:text-void"
        >
          Skip to content
        </a>
        <ServiceWorker />
        <Splash />
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
