'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Mark } from '@/components/brand/Logo';
import { Enter } from '@/components/ui/motion';
import {
  installMode,
  isIos,
  onInstallChange,
  promptInstall,
  type InstallMode,
} from '@/lib/mm/install';
import { ACCENT_HEX } from '@/components/ui/tokens';

/**
 * GET THE APP — a page, not a button that appears when it feels like it.
 *
 * The install button only exists when the browser has decided to offer it, and
 * on iPhone it never exists at all. So an install experience made only of that
 * button is one nobody can find on purpose: it is there when you were not
 * looking for it and gone when you were.
 *
 * This is somewhere to go and find out. It is always reachable, it explains what
 * installing does, it gives the steps for whichever browser you are actually
 * using, and it says plainly what installing does not change.
 */

const STEPS: Record<string, { platform: string; steps: string[] }> = {
  ios: {
    platform: 'iPhone or iPad',
    steps: [
      'Open this page in Safari — Chrome on iPhone cannot add to the home screen.',
      'Tap the Share button (the square with an arrow).',
      'Scroll down and tap "Add to Home Screen".',
      'Tap Add. Mind Miles appears with your other apps.',
    ],
  },
  android: {
    platform: 'Android',
    steps: [
      'Tap the three dots in the top-right of Chrome.',
      'Tap "Add to Home screen" or "Install app".',
      'Confirm. It opens in its own window from then on.',
    ],
  },
  desktop: {
    platform: 'Computer',
    steps: [
      'Look for a small install icon at the right-hand end of the address bar.',
      'Or open the browser menu and choose "Install Mind Miles".',
      'It opens in its own window, without tabs or an address bar.',
    ],
  },
};

export default function InstallPage() {
  const [mode, setMode] = useState<InstallMode>('unavailable');
  const [busy, setBusy] = useState(false);
  const [platform, setPlatform] = useState<keyof typeof STEPS>('desktop');

  useEffect(() => {
    const sync = () => setMode(installMode());
    sync();
    setPlatform(isIos() ? 'ios' : /Android/i.test(navigator.userAgent) ? 'android' : 'desktop');
    return onInstallChange(sync);
  }, []);

  const guide = STEPS[platform];

  return (
    <div className="mx-auto flex max-w-[560px] flex-col gap-7 pb-10">
      <Enter as="section" index={0}>
        <span
          className="flex h-14 w-14 items-center justify-center rounded-[16px] bg-surface-inset"
          style={{ color: ACCENT_HEX.focus }}
        >
          <Mark size={30} />
        </span>
        <h1 className="mt-5 text-[26px] font-[620] leading-tight tracking-tightest">
          {mode === 'installed' ? 'Mind Miles is installed' : 'Put Mind Miles on your home screen'}
        </h1>
        <p className="mt-2.5 text-[15px] leading-relaxed text-chalk-70">
          {mode === 'installed'
            ? 'You are running it from your home screen already. Nothing else to do.'
            : 'It opens like a normal app, in its own window, and works with no connection at all — everything it knows is already on your device.'}
        </p>
      </Enter>

      {mode !== 'installed' && (
        <>
          <Enter as="section" index={1} className="card p-5">
            <p className="label text-chalk-30">What you get</p>
            <ul className="mt-3.5 space-y-3.5">
              <Benefit
                accent={ACCENT_HEX.focus}
                title="One tap from your home screen"
                body="No hunting for a tab. It sits with your other apps and opens in its own window."
              />
              <Benefit
                accent={ACCENT_HEX.recovery}
                title="Works with no signal"
                body="On a train, on a plane, in a lift. Nothing it shows you needs the internet, because none of it is stored anywhere else."
              />
              <Benefit
                accent={ACCENT_HEX.record}
                title="Counts more of your day"
                body="Kept open in the background, it can keep measuring while you get on with things — rather than only while you are looking at it."
              />
            </ul>
          </Enter>

          {mode === 'ready' && (
            <Enter index={2}>
              <button
                type="button"
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  await promptInstall();
                  setMode(installMode());
                  setBusy(false);
                }}
                className="w-full rounded-pill bg-focus px-5 py-3.5 text-[15.5px] font-[600] text-void transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                {busy ? 'Opening your browser’s prompt…' : 'Install Mind Miles'}
              </button>
              <p className="mt-2.5 text-center text-[12px] text-chalk-30">
                Your browser will ask you to confirm.
              </p>
            </Enter>
          )}

          <Enter as="section" index={3} className="card p-5">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="label text-chalk-30">On your {guide.platform.toLowerCase()}</p>
              <div className="flex gap-1">
                {(Object.keys(STEPS) as (keyof typeof STEPS)[]).map((k) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setPlatform(k)}
                    aria-pressed={platform === k}
                    className={`rounded-pill px-2.5 py-1 text-[12px] transition-colors ${
                      platform === k
                        ? 'bg-surface-inset text-chalk'
                        : 'text-chalk-30 hover:text-chalk-70'
                    }`}
                  >
                    {STEPS[k].platform}
                  </button>
                ))}
              </div>
            </div>

            <ol className="mt-4 space-y-3">
              {guide.steps.map((step, i) => (
                <li key={step} className="flex gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-pill bg-surface-inset text-[12px] font-[620] tabular-nums">
                    {i + 1}
                  </span>
                  <span className="text-[14px] leading-relaxed text-chalk-70">{step}</span>
                </li>
              ))}
            </ol>

            {mode === 'unavailable' && platform !== 'ios' && (
              <p className="mt-4 text-[12.5px] leading-relaxed text-chalk-30">
                No install icon yet? Browsers usually wait until you have visited once or twice
                before offering it. The steps above still work.
              </p>
            )}
          </Enter>

          <Enter as="section" index={4} className="card p-5">
            <p className="label text-chalk-30">What it does not change</p>
            <p className="mt-2.5 text-[13.5px] leading-relaxed text-chalk-45">
              Installing does not let Mind Miles see any more of your device than it already can. An
              installed web app is still a browser — it still cannot see your other apps, and it
              never will. If you want your other tabs counted, that takes the browser extension in
              this project, and it says so honestly rather than implying installing is enough.
            </p>
            <p className="mt-3 text-[13.5px] leading-relaxed text-chalk-45">
              Nothing is lost if you never install. The app works exactly the same in a tab.
            </p>
          </Enter>
        </>
      )}

      <p className="text-[12.5px] text-chalk-30">
        <Link href="/guide" className="text-chalk-45 underline underline-offset-2 hover:text-chalk">
          What the numbers mean
        </Link>{' '}
        ·{' '}
        <Link href="/privacy" className="text-chalk-45 underline underline-offset-2 hover:text-chalk">
          What we know about you
        </Link>
      </p>
    </div>
  );
}

function Benefit({ title, body, accent }: { title: string; body: string; accent: string }) {
  return (
    <li className="flex gap-3">
      <span className="mt-[7px] h-2 w-2 shrink-0 rounded-pill" style={{ background: accent }} aria-hidden />
      <div>
        <p className="text-[14.5px] font-[560]">{title}</p>
        <p className="mt-1 text-[13px] leading-relaxed text-chalk-45">{body}</p>
      </div>
    </li>
  );
}
