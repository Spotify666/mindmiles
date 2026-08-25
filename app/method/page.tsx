import type { Metadata } from 'next';
import Link from 'next/link';
import { PROVENANCE_LABEL, PROVENANCE_NOTE, type Provenance } from '@/lib/mm/types';

export const metadata: Metadata = {
  title: 'Method',
  description:
    'Every signal Mind Miles measures, every one it cannot, and the threshold behind each score.',
};

/**
 * THE METHOD PAGE.
 *
 * The product's central claim is that its numbers can be taken apart. This page
 * is where that claim is settled — every threshold used anywhere in lib/mm is
 * listed here, in the same words the code uses, including the ones that make
 * the product look worse.
 */

const SIGNALS: { name: string; provenance: Provenance; note: string }[] = [
  {
    name: 'Engaged time',
    provenance: 'measured',
    note: 'The page visible, the window focused, and input inside the last 60 seconds. A tab left open while you make lunch is not screen time and is not counted.',
  },
  {
    name: 'Keystroke count',
    provenance: 'measured',
    note: 'The number of keydown events. The key value is never read. There is no code path in this app that touches it, and the export contains counts only — you can check.',
  },
  {
    name: 'Clicks and taps',
    provenance: 'measured',
    note: 'Pointer-down count. Not position, not target, not what was clicked.',
  },
  {
    name: 'Scroll distance and velocity',
    provenance: 'measured',
    note: 'Pixels moved, and how fast. Velocity is what separates reading from feed-flicking, and it is the only thing that distinguishes them here — never the site.',
  },
  {
    name: 'Context switches',
    provenance: 'measured',
    note: 'Every time focus or visibility left this tab and came back, plus in-app navigation.',
  },
  {
    name: 'Scroll distance in metres',
    provenance: 'estimated',
    note: 'A CSS pixel is defined as 1/96 inch, so the arithmetic is exact against the spec — but the spec’s inch is a reference angle and your device’s pixel ratio moves the real figure. It is reported in metres and never inflated to kilometres.',
  },
  {
    name: 'Screen brightness',
    provenance: 'estimated',
    note: 'No browser can read display brightness on any platform, and a PWA on your home screen is still a browser. The value you set is used and labelled as declared. If an ambient light sensor is available it is used instead and labelled as measured.',
  },
  {
    name: 'Which app or website',
    provenance: 'unavailable',
    note: 'A page cannot see other tabs, other applications or other devices. Mind Miles does not guess, and it does not ask for a permission that would let it. Time elsewhere is logged by hand.',
  },
  {
    name: 'Operating-system screen time',
    provenance: 'unavailable',
    note: 'Out of reach of any web page. It would need a native companion app, which this is not.',
  },
  {
    name: 'Notifications',
    provenance: 'unavailable',
    note: 'A page cannot count notifications it did not send. No metric here uses a notification count, which is why fragmentation is built from switches instead.',
  },
];

const THRESHOLDS: { rule: string; value: string; why: string }[] = [
  {
    rule: 'One Mind Mile',
    value: '20 engaged minutes',
    why: 'The interval in the 20-20-20 break guideline, and roughly the shortest stretch in which attention research finds people reaching depth. It also puts a normal day between about 5 and 25 miles, which is a range a person can hold in their head.',
  },
  {
    rule: 'A minute counts as engaged',
    value: '20 seconds of activity',
    why: 'Below a third of a minute the minute was a glance, not use.',
  },
  {
    rule: 'A session ends',
    value: 'after a 5-minute gap',
    why: 'Shorter gaps are pauses inside a session — standing up, answering a question — not the end of one.',
  },
  {
    rule: 'A stretch becomes deep',
    value: '25 minutes',
    why: 'Returning to full concentration after an interruption takes around 23 minutes in the classic attention research, so a shorter block rarely contains much depth once the ramp-up is paid for.',
  },
  {
    rule: 'A session counts as a check',
    value: 'under 5 minutes',
    why: 'The signature of compulsive checking rather than use. Fragmentation weighs the share of these heavily.',
  },
  {
    rule: 'A gap counts as recovery',
    value: '10 minutes',
    why: 'Shorter pauses are real but do not restore anything measurable. Only gaps between sessions count — time before your first session is not a break you took.',
  },
  {
    rule: 'Scrolling counts as rapid',
    value: '1,400 px/second',
    why: 'Above this, content is moving past faster than it can be read. This is the single threshold that separates a Scroll Mile from a Focus Mile.',
  },
  {
    rule: 'Evening starts',
    value: '21:00 · late night 23:00',
    why: 'Evening light shifts sleep onset even when total sleep is unchanged, and the effect is strongest after 23:00. Light dose weights minutes by how late they fall for the same reason.',
  },
  {
    rule: 'A baseline needs',
    value: '4 comparable days · 28-day window',
    why: 'Below four days there is no honest normal, and the UI says "baseline building" rather than showing a comparison. Baselines are medians, so one fourteen-hour travel day does not redefine your ordinary Tuesday.',
  },
  {
    rule: 'History is kept for',
    value: '90 days',
    why: 'Long enough for a monthly baseline and a real trend, short enough that the store cannot grow without bound on a device nobody clears.',
  },
];

export default function MethodPage() {
  return (
    <div className="mx-auto flex max-w-[680px] flex-col gap-8 pb-6">
      <header>
        <h1 className="text-[26px] font-[620] tracking-tightest">Method</h1>
        <p className="mt-2.5 text-[14.5px] leading-relaxed text-chalk-70">
          Every score in Mind Miles can be taken apart, and this is where it is taken apart. Below is
          each signal the app measures, each one it cannot, and every threshold used anywhere in the
          scoring — including the ones that make the product look less impressive than it could.
        </p>
      </header>

      <section>
        <h2 className="text-[18px] font-[620] tracking-tightest">What the four labels mean</h2>
        <ul className="mt-3.5 space-y-2.5">
          {(['measured', 'derived', 'estimated', 'unavailable'] as Provenance[]).map((p) => (
            <li key={p} className="rounded-[14px] border border-hair p-3.5">
              <p className="label text-chalk-70">{PROVENANCE_LABEL[p]}</p>
              <p className="mt-1.5 text-[13px] leading-relaxed text-chalk-45">{PROVENANCE_NOTE[p]}</p>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="text-[18px] font-[620] tracking-tightest">Every signal</h2>
        <ul className="mt-3.5 space-y-2.5">
          {SIGNALS.map((s) => (
            <li key={s.name} className="rounded-[14px] border border-hair p-3.5">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="text-[14.5px] font-[560]">{s.name}</span>
                <span
                  className={`label rounded-pill px-1.5 py-0.5 ${
                    s.provenance === 'measured'
                      ? 'text-recovery'
                      : s.provenance === 'estimated'
                        ? 'border border-strain/25 bg-strain-dim text-strain'
                        : s.provenance === 'unavailable'
                          ? 'border border-hair text-chalk-30'
                          : 'text-chalk-45'
                  }`}
                >
                  {PROVENANCE_LABEL[s.provenance]}
                </span>
              </div>
              <p className="mt-2 text-[13px] leading-relaxed text-chalk-45">{s.note}</p>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="text-[18px] font-[620] tracking-tightest">Every threshold</h2>
        <p className="mt-2 text-[13px] leading-relaxed text-chalk-45">
          These are the constants the scoring actually uses. They are in one file,{' '}
          <code className="rounded bg-surface-inset px-1.5 py-0.5 text-[12px]">lib/mm/aggregate.ts</code>
          , with the reasoning attached to each.
        </p>
        <ul className="mt-3.5 space-y-2.5">
          {THRESHOLDS.map((t) => (
            <li key={t.rule} className="rounded-[14px] border border-hair p-3.5">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="text-[14.5px] font-[560]">{t.rule}</span>
                <span className="text-[14px] font-[620] tabular-nums text-focus">{t.value}</span>
              </div>
              <p className="mt-2 text-[13px] leading-relaxed text-chalk-45">{t.why}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-card border border-hair bg-surface p-4">
        <h2 className="text-[18px] font-[620] tracking-tightest">What this is not</h2>
        <div className="mt-3 space-y-3 text-[13px] leading-relaxed text-chalk-45">
          <p>
            <span className="text-chalk">Not a medical instrument.</span> Visual Load estimates how
            hard a day asked your eyes to work. It is not a statement about your eyes, and nothing
            here diagnoses eye strain, sleep disorder or an attention problem. The scores are
            transparent heuristics over published ergonomic and sleep guidance — a mirror for your
            own trend.
          </p>
          <p>
            <span className="text-chalk">Not calibrated against a population.</span> There are no
            population averages anywhere in this product. Every comparison is against your own
            history, partly because the alternative would require sending your behaviour somewhere,
            and mostly because a developer&rsquo;s Tuesday and a nurse&rsquo;s Tuesday have no business being
            scored on the same curve.
          </p>
          <p>
            <span className="text-chalk">Not a complete picture.</span> This measures one browser on
            one device. Anything outside it is either logged by hand or absent, and the app says
            which. A low number here can mean a calm day or a day spent on a different machine, and
            it will not pretend to know the difference.
          </p>
          <p>
            <span className="text-chalk">Not sample-free on first run.</span> A new install seeds 30
            days of generated history so the charts are readable on day one. It is labelled as sample
            data and can be cleared in one tap from your profile; real measurement accumulates
            alongside it from the moment the app is opened.
          </p>
        </div>
      </section>

      <p className="text-[12.5px] text-chalk-30">
        <Link href="/privacy" className="text-chalk-45 underline underline-offset-2 hover:text-chalk">
          What Mind Miles knows about you
        </Link>
      </p>
    </div>
  );
}
