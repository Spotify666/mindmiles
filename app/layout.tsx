import type { Metadata, Viewport } from 'next';
import { Figtree } from 'next/font/google';
import './globals.css';
import PhotonProvider from '@/components/PhotonProvider';
import Splash from '@/components/Splash';
import ServiceWorker from '@/components/ServiceWorker';
import TopBar from '@/components/nav/TopBar';
import { TabBar } from '@/components/nav/TabBar';

/**
 * One family, doing everything.
 *
 * The previous shell paired a tight grotesque with a monospace used for every
 * small label in tracked-out capitals — an instrument-panel convention, and
 * exactly wrong for a page meant to read as something a person made. Figtree is
 * warm, geometric and holds up at both 12px and 40px, so labels can simply be
 * small text rather than a second typographic voice.
 */
const sans = Figtree({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
  weight: ['400', '500', '600', '700', '800'],
});

export const metadata: Metadata = {
  title: {
    default: 'Photon — see what your screens are really doing',
    template: '%s · Photon',
  },
  description:
    'Photon measures how you actually use your screens — not just how long — and turns it into focus, rest and time you got back. Everything stays on your device.',
  applicationName: 'Photon',
  robots: { index: true, follow: true },
  openGraph: {
    title: 'Photon',
    description: 'See what your screens are really doing.',
    type: 'website',
  },
  appleWebApp: { capable: true, title: 'Photon', statusBarStyle: 'default' },
  manifest: '/manifest.webmanifest',
};

export const viewport: Viewport = {
  themeColor: '#EFF4F9',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={sans.variable}>
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
              `var seen=sessionStorage.getItem('photon.splash.seen')==='1';` +
              // A first-time visitor goes straight to the welcome. The welcome IS
              // the entrance; putting a 2.5s title card in front of it just hides
              // the one screen that explains what this is.
              `var raw=localStorage.getItem('photon.v1');` +
              `var first=true;try{first=!raw||JSON.parse(raw).onboarded!==true}catch(e){}` +
              `if(seen||first){document.documentElement.classList.add('splash-skip')}` +
              `}catch(e){}`,
          }}
        />
      </head>
      <body className="font-sans antialiased">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[80] focus:rounded-pill focus:bg-focus focus:px-4 focus:py-2 focus:text-sm focus:font-bold focus:text-white"
        >
          Skip to content
        </a>
        <ServiceWorker />
        <Splash />
        <PhotonProvider>
          <TopBar />
          {/* Bottom padding clears the mobile tab bar. */}
          <main id="main" className="safe-x mx-auto max-w-wide pb-28 pt-5 md:pb-16">
            {children}
          </main>
          <TabBar />
        </PhotonProvider>
      </body>
    </html>
  );
}
