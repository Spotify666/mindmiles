import type { Metadata } from 'next';
import Link from 'next/link';
import { PROVENANCE_LABEL, PROVENANCE_NOTE, type Provenance } from '@/lib/mm/types';

export const metadata: Metadata = {
  title: 'How it works',
  description: 'What Photon counts, what it cannot, and the numbers behind every score.',
};

/**
 * HOW IT WORKS.
 *
 * The product's central claim is that its numbers can be taken apart, and this
 * page is where that gets settled. Every threshold used anywhere in lib/mm is
 * listed, including the ones that make the product look less clever.
 *
 * Written for someone who has never read a methodology page and does not want
 * to start now: short lines, no jargon, and the honest answer first.
 */

const SIGNALS: { name: string; provenance: Provenance; note: string }[] = [
  {
    name: 'Time on screen',
    provenance: 'measured',
    note: 'The page has to be open, in front of you, and you have to have touched something in the last minute. A tab left open while you make lunch does not count.',
  },
  {
    name: 'Key presses',
    provenance: 'measured',
    note: 'We count how many times you press a key. We never look at which key. Not once, anywhere in the app — and your download proves it, because it only contains numbers.',
  },
  {
    name: 'Taps and clicks',
    provenance: 'measured',
    note: 'How many. Not where, and not what you tapped.',
  },
  {
    name: 'Scrolling',
    provenance: 'measured',
    note: 'How far the page moved, and how fast. Speed is the only thing that tells reading apart from flicking — never the website you were on.',
  },
  {
    name: 'Jumping away and back',
    provenance: 'measured',
    note: 'Every time you left this page and came back.',
  },
  {
    name: 'How far you scrolled, in metres',
    provenance: 'estimated',
    note: 'Worked out from how far the page moved. Screens differ, so the real figure wobbles. We show it in metres and never puff it up into kilometres.',
  },
  {
    name: 'How much light is around you',
    provenance: 'estimated',
    note: 'If your device has a light sensor, we read it. If not, you can let us take one frame from your camera — we look at how bright the room is, then throw the picture away. Neither one is your screen brightness: no web page can read that, on any device. So this is a good guess, and we always say which way we got it.',
  },
  {
    name: 'Which website you were on',
    provenance: 'estimated',
    note: 'A web page cannot see your other tabs. Our browser add-on can, if you install it — it counts time per website, and nothing else. Without it we do not guess. Apps that are not websites stay out of reach either way, so you can add that time by hand.',
  },
  {
    name: 'A stretch you meant to do',
    provenance: 'measured',
    note: 'When you start a block we record the time you pressed it and the length you chose. Nothing else — whether you were actually there is read back afterwards from the same minutes as everything else, and a block never changes a score.',
  },
  {
    name: 'Your phone’s own screen time',
    provenance: 'unavailable',
    note: 'Out of reach of any website. It would need an app installed on your phone, and this is not one.',
  },
  {
    name: 'Notifications',
    provenance: 'unavailable',
    note: 'A web page cannot count notifications it did not send. No score here uses them — which is why we count your jumps instead.',
  },
];

const THRESHOLDS: { rule: string; value: string; why: string }[] = [
  {
    rule: 'One mile is',
    value: '20 minutes on screen',
    why: 'Twenty minutes is how often eye doctors suggest looking away, and about the shortest stretch in which people get properly stuck into something. It also puts a normal day between about 5 and 25 miles, which is a range you can hold in your head.',
  },
  {
    rule: 'A minute counts when you used',
    value: '20 seconds of it',
    why: 'Less than that and you glanced at your phone rather than used it.',
  },
  {
    rule: 'A visit ends after',
    value: 'a 5-minute gap',
    why: 'Shorter gaps are pauses — standing up, answering someone — not the end of what you were doing.',
  },
  {
    rule: 'A block counts as long at',
    value: '25 minutes',
    why: 'It takes about 23 minutes to get your head fully back into something after an interruption. A shorter block is mostly spent getting started.',
  },
  {
    rule: 'A visit counts as a quick check under',
    value: '5 minutes',
    why: 'Too short to have been doing anything. This is what turns hours into nothing much.',
  },
  {
    rule: 'A break counts at',
    value: '10 minutes',
    why: 'Shorter pauses are real, but they do not put anything back. Only gaps between visits count — time before you started is not a break you took.',
  },
  {
    rule: 'Scrolling counts as fast at',
    value: '1,400 pixels a second',
    why: 'Above that, things are going past faster than you could read them. This one line is what separates a Scroll Mile from a Focus Mile.',
  },
  {
    rule: 'A stretch stays one stretch while it is at least',
    value: '60% full',
    why: 'Short pauses inside a session are still that session, so a gap of five minutes or less does not end it. But that tolerance chains: a tab you glance at every three minutes would otherwise join up into one sixteen-hour "unbroken session" of deep focus, which is the opposite of what happened. So a stretch only counts as continuous if the time you were actually there fills most of the clock it covers.',
  },
  {
    rule: 'The eye-rest nudge fires after',
    value: '20 minutes of screen',
    why: 'The 20-20-20 rule: every twenty minutes, look at something far away for twenty seconds. It counts screen time rather than clock time, so a break resets it and it never arrives for work you did not do. It is off until you switch it on, and it is the only notification this app has.',
  },
  {
    rule: 'Evening starts at',
    value: '9pm · late night 11pm',
    why: 'Screen light in the evening makes sleep come later even if you sleep just as long, and the effect is strongest after 11pm.',
  },
  {
    rule: 'Before we can say “usual” we need',
    value: '4 similar days',
    why: 'Fewer than four and there is no honest normal, so we say we are still learning instead. We use the middle day rather than the average, so one wild Tuesday does not redefine your ordinary ones. We look back four weeks.',
  },
  {
    rule: 'We keep your history for',
    value: '90 days',
    why: 'Long enough to see a real change, short enough that it cannot pile up forever on a device nobody clears.',
  },
];

export default function MethodPage() {
  return (
    <div className="mx-auto flex max-w-[680px] flex-col gap-8 pb-6">
      <header>
        <h1 className="display text-[28px]">How it <span className="marked">works</span></h1>
        <p className="mt-2.5 text-[14.5px] leading-relaxed text-ink-soft">
          Every score in this app can be taken apart, and this is where it gets taken apart. Here is
          what we can count, what we honestly cannot, and every number behind the scores — including
          the ones that make us look less clever than we would like.
        </p>
      </header>

      <section>
        <h2 className="display text-[18px]">Four labels you will see</h2>
        <ul className="mt-3.5 space-y-2.5">
          {(['measured', 'derived', 'estimated', 'unavailable'] as Provenance[]).map((p) => (
            <li key={p} className="panel p-3.5">
              <p className="label text-ink-soft">{PROVENANCE_LABEL[p]}</p>
              <p className="mt-1.5 text-[13px] leading-relaxed text-ink-faint">{PROVENANCE_NOTE[p]}</p>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="display text-[18px]">What we can and cannot see</h2>
        <ul className="mt-3.5 space-y-2.5">
          {SIGNALS.map((s) => (
            <li key={s.name} className="panel p-3.5">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="text-[14.5px] font-semibold">{s.name}</span>
                <span
                  className={`label rounded-pill px-1.5 py-0.5 ${
                    s.provenance === 'measured'
                      ? 'text-rest-text'
                      : s.provenance === 'estimated'
                        ? 'border border-effort/40 bg-effort-wash text-effort'
                        : s.provenance === 'unavailable'
                          ? 'border border-ink/15 text-ink-faint'
                          : 'text-ink-faint'
                  }`}
                >
                  {PROVENANCE_LABEL[s.provenance]}
                </span>
              </div>
              <p className="mt-2 text-[13px] leading-relaxed text-ink-faint">{s.note}</p>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="display text-[18px]">Every number we use</h2>
        <p className="mt-2 text-[13px] leading-relaxed text-ink-faint">
          These are the actual cut-offs behind the scores. They all live in one file, with the reason
          for each written next to it.
        </p>
        <ul className="mt-3.5 space-y-2.5">
          {THRESHOLDS.map((t) => (
            <li key={t.rule} className="panel p-3.5">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="text-[14.5px] font-semibold">{t.rule}</span>
                <span className="text-[14px] font-bold tabular-nums text-focus">{t.value}</span>
              </div>
              <p className="mt-2 text-[13px] leading-relaxed text-ink-faint">{t.why}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-card border border-ink/15 bg-card p-4">
        <h2 className="display text-[18px]">What this is not</h2>
        <div className="mt-3 space-y-3 text-[13px] leading-relaxed text-ink-faint">
          <p>
            <span className="text-ink">It is not a doctor.</span> The Eyes score is a guess at how
            hard a day asked your eyes to work. It is not a statement about your eyes, and nothing
            here diagnoses eye strain, sleep problems or anything else. The scores are simple rules
            built on well-known advice — a mirror, not a medical test.
          </p>
          <p>
            <span className="text-ink">It never compares you to other people.</span> There are no
            averages from anyone else in this app. Everything is measured against your own past —
            partly because comparing would mean sending your habits somewhere, and mostly because a
            builder&rsquo;s Tuesday and a nurse&rsquo;s Tuesday are not the same thing.
          </p>
          <p>
            <span className="text-ink">It does not see everything.</span> This measures one browser
            on one device. Anything else is added by you or marked as something we cannot see. A low
            number might mean a calm day, or a day spent on a different machine — and we will not
            pretend to know which.
          </p>
          <p>
            <span className="text-ink">Day one is made up.</span> A brand new install comes with 30
            days of example data so the charts make sense straight away. It says so wherever it
            appears, and you can wipe it in one tap from your profile. Your real days start counting
            the moment you open the app.
          </p>
        </div>
      </section>

      <p className="text-[12.5px] text-ink-faint">
        <Link href="/privacy" className="text-ink-faint underline underline-offset-2 hover:text-ink">
          What we know about you
        </Link>
      </p>
    </div>
  );
}
