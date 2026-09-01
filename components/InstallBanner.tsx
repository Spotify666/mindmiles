'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Mark } from '@/components/brand/Logo';
import { installMode, onInstallChange } from '@/lib/mm/install';

/**
 * The indicator on Today.
 *
 * Discoverability was the actual problem: the install button only existed while
 * the browser felt like offering it, and on iPhone it never existed at all — so
 * it was there when you were not looking and gone when you were.
 *
 * This is always present until the app is installed or the row is dismissed,
 * and it always leads somewhere that can explain itself. Dismissing is
 * remembered, because a banner you cannot get rid of is worse than no banner.
 */

const DISMISSED = 'mindmiles.install.dismissed';

export default function InstallBanner() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const sync = () => {
      let dismissed = false;
      try {
        dismissed = localStorage.getItem(DISMISSED) === '1';
      } catch {
        // Blocked storage: show it. An extra row beats a silently missing one.
      }
      setShow(!dismissed && installMode() !== 'installed');
    };
    sync();
    return onInstallChange(sync);
  }, []);

  if (!show) return null;

  return (
    <div className="card flex items-center gap-3 p-3">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-surface-inset text-focus">
        <Mark size={19} />
      </span>

      <Link href="/install" className="min-w-0 flex-1">
        <p className="text-[13.5px] font-[560]">Get Mind Miles as an app</p>
        <p className="mt-0.5 truncate text-[12px] text-chalk-45">
          One tap from your home screen, works offline
        </p>
      </Link>

      <Link
        href="/install"
        className="label shrink-0 rounded-pill border border-focus/40 bg-focus-dim px-2.5 py-1.5 text-focus transition-colors hover:bg-focus/20"
      >
        Get it
      </Link>

      <button
        type="button"
        aria-label="Hide this"
        onClick={() => {
          try {
            localStorage.setItem(DISMISSED, '1');
          } catch {
            /* it will reappear next time, which is acceptable */
          }
          setShow(false);
        }}
        className="shrink-0 rounded-pill px-1.5 py-1 text-[15px] leading-none text-chalk-30 transition-colors hover:text-chalk-70"
      >
        ×
      </button>
    </div>
  );
}
