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
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-surface-inset text-recovery">
            <Mark size={20} />
          </span>
          <div>
            <p className="text-[14.5px] font-[560]">Installed</p>
            <p className="mt-0.5 text-[12.5px] text-chalk-45">
              You are running Mind Miles from your home screen.
            </p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="card p-4">
      <div className="flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-surface-inset text-focus">
          <Mark size={20} />
        </span>
        <div className="min-w-0">
          <p className="text-[14.5px] font-[560]">Put Mind Miles on your home screen</p>
          <p className="mt-1 text-[12.5px] leading-relaxed text-chalk-45">
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
          className="mt-3.5 w-full rounded-pill bg-focus px-4 py-2.5 text-[14px] font-[560] text-void transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {busy ? 'Opening your browser’s prompt…' : 'Install app'}
        </button>
      )}

      {mode === 'ios' && (
        <button
          type="button"
          onClick={() => setShowIos(true)}
          className="mt-3.5 w-full rounded-pill border border-hair px-4 py-2.5 text-[14px] text-chalk-70 transition-colors hover:border-hair-strong hover:text-chalk"
        >
          How to add it on iPhone
        </button>
      )}

      {mode === 'unavailable' && (
        <p className="mt-3.5 text-[12px] leading-relaxed text-chalk-30">
          Your browser has not offered to install this yet. Chrome, Edge and Android usually offer it
          after a visit or two; on iPhone use Safari&rsquo;s Share menu. Nothing is missing if you
          never install — the app works exactly the same in a tab.
        </p>
      )}

      <p className="mt-3 text-[11.5px] leading-relaxed text-chalk-30">
        Installing does not let us see any more than we already can. An installed web app is still a
        browser, so it still cannot see your other apps — that part is unchanged, and we will not
        pretend otherwise.
      </p>

      <Sheet open={showIos} onClose={() => setShowIos(false)} title="Add to your home screen">
        <p className="text-[14px] leading-relaxed text-chalk-70">
          iPhone does not let a website install itself, so this takes three taps in Safari.
        </p>
        <ol className="mt-4 space-y-3">
          {IOS_STEPS.map((step, i) => (
            <li key={step} className="flex gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-pill bg-surface-inset text-[12px] font-[620] tabular-nums">
                {i + 1}
              </span>
              <span className="text-[14px] leading-relaxed">{step}</span>
            </li>
          ))}
        </ol>
        <p className="mt-4 text-[12.5px] leading-relaxed text-chalk-45">
          It has to be Safari — Chrome on iPhone cannot add to the home screen.
        </p>
      </Sheet>
    </section>
  );
}
