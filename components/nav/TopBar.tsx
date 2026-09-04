'use client';

import Link from 'next/link';
import { Wordmark } from '@/components/brand/Logo';
import { useEffect, useState } from 'react';
import { DesktopNav } from './TabBar';
import { usePhoton } from '@/components/PhotonProvider';
import { installMode, onInstallChange } from '@/lib/mm/install';

/**
 * The header. Deliberately thin: this is a measurement product, and the first
 * screenful belongs to the measurement rather than to branding.
 */
export default function TopBar() {
  // The welcome carries its own mark and has nowhere to navigate to. A header
  // above it is two wordmarks and a dead nav.
  const { state } = usePhoton();
  const install = useInstallOffer();
  if (!state.onboarded) return null;

  return (
    <header className="sticky top-0 z-30 border-b border-ink/15 bg-paper/88 backdrop-blur-lg">
      <div className="safe-x mx-auto flex h-14 max-w-wide items-center justify-between gap-4">
        <Link href="/" aria-label="Photon — home" className="shrink-0">
          <Wordmark size="sm" />
        </Link>
        <DesktopNav />
        <div className="flex shrink-0 items-center gap-3">
          {/*
            Always a way in until it is installed — never a control that appears
            only when the browser feels like offering it. It leads to /install,
            which can explain itself on any platform, rather than firing a prompt
            that may not exist.
          */}
          {!install.installed && (
            <Link
              href="/install"
              className="label rounded-pill border border-focus/40 bg-focus-wash px-2.5 py-1 text-focus transition-colors hover:bg-focus/20"
            >
              Get the app
            </Link>
          )}
          <Link
            href="/guide"
            className="label text-ink-faint transition-colors hover:text-ink-soft"
          >
            What it all means
          </Link>
        </div>
      </div>
    </header>
  );
}

/** Whether the header should still be offering the app. */
function useInstallOffer() {
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    const sync = () => setInstalled(installMode() === 'installed');
    sync();
    return onInstallChange(sync);
  }, []);

  return { installed };
}
