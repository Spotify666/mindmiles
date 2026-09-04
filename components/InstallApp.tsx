'use client';

import { useEffect, useState } from 'react';
import {
  installMode,
  IOS_STEPS,
  onInstallChange,
  promptInstall,
  type InstallMode,
} from '@/lib/mm/install';
import { Mark } from '@/components/brand/Logo';
import Sheet from '@/components/ui/Sheet';
import Link from 'next/link';

/**
 * The install offer.
 *
 * Deliberately honest per platform: a real button where the browser can
 * actually install, plain instructions on iOS where it cannot, and nothing at
 * all once the app is already on the home screen.
 *
 * It also says what installing does and does not change — because for this app
 * the answer is unusual. Installing makes it open like an app and work with no
 * connection. It does NOT unlock any extra measurement: an installed PWA is
 * still a browser and still cannot see your other apps. Implying otherwise
 * would be the most tempting lie this product could tell.
 */
export default function InstallApp() {
  const [mode, setMode] = useState<InstallMode>('unavailable');
  const [showIos, setShowIos] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const sync = () => setMode(installMode());
    sync();
    return onInstallChange(sync);
  }, []);

  if (mode === 'installed') {
    return (
      <section className="card p-4">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center panel text-rest-text">
            <Mark size={20} />
          </span>
          <div>
            <p className="text-[14.5px] font-semibold">Installed</p>
            <p className="mt-0.5 text-[12.5px] text-ink-faint">
              You are running Photon from your home screen.
            </p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="card p-4">
      <div className="flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center panel text-focus">
          <Mark size={20} />
        </span>
        <div className="min-w-0">
          <p className="text-[14.5px] font-semibold">Put Photon on your home screen</p>
          <p className="mt-1 text-[12.5px] leading-relaxed text-ink-faint">
            Opens like an app, in its own window, and works with no connection — everything it knows
            is already on your device.
          </p>
        </div>
      </div>

      {mode === 'ready' && (
        <button
          type="button"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            await promptInstall();
            setMode(installMode());
            setBusy(false);
          }}
          className="mt-3.5 w-full btn btn-primary hatch px-4 py-2.5 text-[14px] disabled:opacity-50"
        >
          {busy ? 'Opening your browser’s prompt…' : 'Install app'}
        </button>
      )}

      {mode === 'ios' && (
        <button
          type="button"
          onClick={() => setShowIos(true)}
          className="mt-3.5 w-full btn btn-quiet px-4 py-2.5 text-[14px]"
        >
          How to add it on iPhone
        </button>
      )}

      {mode === 'unavailable' && (
        <Link
          href="/install"
          className="mt-3.5 block w-full rounded-pill border border-ink/15 px-4 py-2.5 text-center text-[14px] text-ink-soft transition-colors hover:border-ink hover:text-ink"
        >
          Show me how
        </Link>
      )}

      <p className="mt-3 text-[11.5px] leading-relaxed text-ink-faint">
        Installing does not let us see any more than we already can. An installed web app is still a
        browser, so it still cannot see your other apps — that part is unchanged, and we will not
        pretend otherwise.
      </p>

      <Sheet open={showIos} onClose={() => setShowIos(false)} title="Add to your home screen">
        <p className="text-[14px] leading-relaxed text-ink-soft">
          iPhone does not let a website install itself, so this takes three taps in Safari.
        </p>
        <ol className="mt-4 space-y-3">
          {IOS_STEPS.map((step, i) => (
            <li key={step} className="flex gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-pill bg-paper text-[12px] font-bold tabular-nums">
                {i + 1}
              </span>
              <span className="text-[14px] leading-relaxed">{step}</span>
            </li>
          ))}
        </ol>
        <p className="mt-4 text-[12.5px] leading-relaxed text-ink-faint">
          It has to be Safari — Chrome on iPhone cannot add to the home screen.
        </p>
      </Sheet>
    </section>
  );
}
