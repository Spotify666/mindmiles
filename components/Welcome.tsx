'use client';

import { useEffect, useState } from 'react';
import { Wordmark } from '@/components/brand/Logo';
import { Enter } from '@/components/ui/motion';
import { ACCENT_HEX } from '@/components/ui/tokens';

/**
 * THE FRONT DOOR.
 *
 * Landing straight on a dashboard tells a first-time visitor nothing about what
 * they have opened. Six numbers appear, none of them mean anything yet, and the
 * one idea the product exists for never gets said.
 *
 * So this screen says it — and shows it, because the idea is visual. Two days,
 * five hours each, drawn side by side: one in solid blocks, one in confetti.
 * That picture is the entire argument for the product, and it lands before a
 * single word about metrics.
 *
 * It appears once. After that the door is Today, which is where a returning
 * user wants to be.
 */

/** The comparison, in the app's own mileage colours. */
const SOLID = [
  [4, 26],
  [34, 22],
  [62, 18],
  [84, 14],
] as const;

const SHATTERED = [
  [2, 3],
  [7, 2],
  [11, 4],
  [18, 2],
  [22, 3],
  [28, 2],
  [33, 5],
  [41, 2],
  [45, 3],
  [51, 2],
  [56, 4],
  [63, 2],
  [67, 3],
  [73, 2],
  [78, 4],
  [85, 2],
  [90, 3],
  [95, 3],
] as const;

function DayBar({
  segments,
  color,
  delayBase,
  label,
  caption,
}: {
  segments: readonly (readonly [number, number])[];
  color: string;
  delayBase: number;
  label: string;
  caption: string;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-[13.5px] font-[560]">{label}</span>
        <span className="label text-chalk-30">5 hours</span>
      </div>

      <div className="relative mt-2.5 h-9 w-full overflow-hidden rounded-[8px] bg-surface-inset">
        {segments.map(([x, w], i) => (
          <span
            key={x}
            className="mm-seg absolute inset-y-0 rounded-[3px]"
            style={{
              left: `${x}%`,
              width: `${w}%`,
              background: color,
              animationDelay: `${delayBase + i * 34}ms`,
            }}
          />
        ))}
      </div>

      <p className="mt-2 text-[12.5px] leading-snug text-chalk-45">{caption}</p>
    </div>
  );
}

function Point({ title, body, accent }: { title: string; body: string; accent: string }) {
  return (
    <li className="flex gap-3">
      <span
        className="mt-[7px] h-2 w-2 shrink-0 rounded-pill"
        style={{ background: accent }}
        aria-hidden
      />
      <div>
        <p className="text-[14.5px] font-[560]">{title}</p>
        <p className="mt-1 text-[13px] leading-relaxed text-chalk-45">{body}</p>
      </div>
    </li>
  );
}

export default function Welcome({ onStart }: { onStart: () => void }) {
  // The comparison only starts drawing once it has had a moment on screen —
  // arriving mid-animation robs it of the beat that makes the point land.
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    const id = setTimeout(() => setArmed(true), 260);
    return () => clearTimeout(id);
  }, []);

  return (
    // Bottom padding reserves room for the fixed action bar on small screens,
    // so the last card is never sitting underneath it.
    <div className="mx-auto flex max-w-[560px] flex-col gap-9 pb-40 md:pb-10">
      <Enter as="section" index={0} className="pt-6">
        <Wordmark size="lg" variant="gradient" tagline />
        <h1 className="mt-9 text-[30px] font-[620] leading-[1.12] tracking-tightest">
          A fitness tracker
          <br />
          for your attention.
        </h1>
        <p className="mt-3.5 text-[15px] leading-relaxed text-chalk-70">
          Your phone already tells you how many hours you spent on it. That number cannot tell a
          good day from a bad one. This can.
        </p>
      </Enter>

      {/* The whole argument, in one picture. */}
      <Enter as="section" index={1} className="card p-5">
        <p className="label text-chalk-30">Two people. Same five hours.</p>

        <div className={`mt-4 space-y-5 ${armed ? 'mm-armed' : ''}`}>
          <DayBar
            segments={SOLID}
            color={ACCENT_HEX.focus}
            delayBase={0}
            label="Someone who had a good day"
            caption="Four long stretches. They got somewhere."
          />
          <DayBar
            segments={SHATTERED}
            color={ACCENT_HEX.strain}
            delayBase={340}
            label="Someone who had a rough one"
            caption="Eighteen quick check-ins. Nothing to show for it."
          />
        </div>

        <p className="mt-5 text-[14px] leading-relaxed text-chalk-70">
          Screen time counts both of these as <span className="font-[620] text-chalk">5 hours</span>.
          We count what actually happened.
        </p>
      </Enter>

      <Enter as="section" index={2}>
        <p className="label text-chalk-30">What we do</p>
        <ul className="mt-3.5 space-y-4">
          <Point
            accent={ACCENT_HEX.focus}
            title="We watch how you use it, not how long"
            body="How long you stick with one thing. How often you hop about. How fast you scroll. Whether you take breaks."
          />
          <Point
            accent={ACCENT_HEX.recovery}
            title="We compare you to you"
            body="Never to anyone else. After a few days we learn what a normal day looks like for you, and tell you when today is different."
          />
          <Point
            accent={ACCENT_HEX.record}
            title="We give you something to beat"
            body="Your longest run of focus. Your calmest day. Your best week. Things worth being pleased about."
          />
          <Point
            accent={ACCENT_HEX.scatter}
            title="We never tell you off"
            body="A busy day is a busy day, not a failure. Not opening this app for a week because life is going well is a win, not a problem."
          />
        </ul>
      </Enter>

      <Enter as="section" index={3} className="card p-5">
        <p className="label text-chalk-30">Before you start</p>
        <p className="mt-2.5 text-[14px] leading-relaxed text-chalk-70">
          Everything stays on this device. There is no account and nowhere to send anything — we
          count how many keys you press, and never which ones.
        </p>
        <p className="mt-3 text-[13px] leading-relaxed text-chalk-45">
          To get you started, the charts are filled with a month of made-up example days. You can
          wipe them in one tap. Your real days start counting the moment you begin.
        </p>
      </Enter>

      {/*
        Fixed to the bottom on a phone so the way in is always within reach, with
        a scrim behind it — a floating button over live text obscures whatever it
        happens to be sitting on. On a wider screen it simply ends the page.
      */}
      <div className="mm-cta safe-b safe-x fixed inset-x-0 bottom-0 z-30 pb-6 pt-20 md:static md:pb-0 md:pt-0">
        <div className="mx-auto max-w-[560px]">
          <button
            type="button"
            onClick={onStart}
            className="w-full rounded-pill bg-focus px-5 py-3.5 text-[15.5px] font-[600] text-void shadow-lg transition-opacity hover:opacity-90"
          >
            Start measuring
          </button>
          <p className="mt-2.5 text-center text-[12px] text-chalk-30">
            Takes no setup. Nothing to sign up for.
          </p>
        </div>
      </div>
    </div>
  );
}
