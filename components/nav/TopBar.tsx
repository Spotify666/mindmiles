'use client';

import Link from 'next/link';
import { Wordmark } from '@/components/brand/Logo';
import { DesktopNav } from './TabBar';
import { useMindMiles } from '@/components/MindMilesProvider';

/**
 * The header. Deliberately thin: this is a measurement product, and the first
 * screenful belongs to the measurement rather than to branding.
 */
export default function TopBar() {
  // The welcome carries its own mark and has nowhere to navigate to. A header
  // above it is two wordmarks and a dead nav.
  const { state } = useMindMiles();
  if (!state.onboarded) return null;

  return (
    <header className="sticky top-0 z-30 border-b border-hair bg-void/88 backdrop-blur-lg">
      <div className="safe-x mx-auto flex h-14 max-w-wide items-center justify-between gap-4">
        <Link href="/" aria-label="Mind Miles — home" className="shrink-0">
          <Wordmark size="sm" variant="gradient" />
        </Link>
        <DesktopNav />
        <Link
          href="/method"
          className="label shrink-0 text-chalk-30 transition-colors hover:text-chalk-70"
        >
          How it works
        </Link>
      </div>
    </header>
  );
}
