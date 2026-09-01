'use client';

import Link from 'next/link';
import { Wordmark } from '@/components/brand/Logo';
import { useEffect, useState } from 'react';
import { DesktopNav } from './TabBar';
import { useMindMiles } from '@/components/MindMilesProvider';
import { installMode, onInstallChange, promptInstall } from '@/lib/mm/install';

/**
 * The header. Deliberately thin: this is a measurement product, and the first
 * screenful belongs to the measurement rather than to branding.
 */
export default function TopBar() {
  // The welcome carries its own mark and has nowhere to navigate to. A header
  // above it is two wordmarks and a dead nav.
  const { state } = useMindMiles();
  const install = useInstallOffer();
  if (!state.onboarded) return null;

  return (
    <header className="sticky top-0 z-30 border-b border-hair bg-void/88 backdrop-blur-lg">
      <div className="safe-x mx-auto flex h-14 max-w-wide items-center justify-between gap-4">
        <Link href="/" aria-label="Mind Miles — home" className="shrink-0">
          <Wordmark size="sm" variant="gradient" />
        </Link>
        <DesktopNav />
        <div className="flex shrink-0 items-center gap-3">
          {/* Only shown when the browser can genuinely install — otherwise the
              profile explains the platform's own route. */}
          {install.canPrompt && (
            <button
              type="button"
              onClick={install.prompt}
              className="label rounded-pill border border-focus/40 bg-focus-dim px-2.5 py-1 text-focus transition-colors hover:bg-focus/20"
            >
              Install app
            </button>
          )}
          <Link
            href="/guide"
            className="label text-chalk-30 transition-colors hover:text-chalk-70"
          >
            What it all means
          </Link>
        </div>
      </div>
    </header>
  );
}

/** Whether to offer installing from the header, and how to do it. */
function useInstallOffer() {
  const [canPrompt, setCanPrompt] = useState(false);

  useEffect(() => {
    const sync = () => setCanPrompt(installMode() === 'ready');
    sync();
    return onInstallChange(sync);
  }, []);

  return {
    canPrompt,
    prompt: async () => {
      await promptInstall();
      setCanPrompt(installMode() === 'ready');
    },
  };
}
