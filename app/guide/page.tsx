import type { Metadata } from 'next';
import Link from 'next/link';
import { ACCENT_HEX } from '@/components/ui/tokens';

export const metadata: Metadata = {
  title: 'What the numbers mean',
  description: 'Every number Photon shows you, explained in plain words.',
};

/**
 * WHAT THE NUMBERS MEAN.
 *
 * The explain sheet answers "how was this number worked out" for one metric,
 * while you are looking at it. This page answers the different question people
 * actually ask first: "what are all these, and which ones should I care about?"
 *
 * Written to be read start to finish by someone who has never opened the app.
 * Every entry says the same four things in the same order — what it means, what
 * goes into it, which way is good, and what to do about it — because a
 * reference you can skim is worth more than one you have to read.
 */

interface Entry {
  name: string;
  meaning: string;
  accent: string;
  direction: string;
  madeOf: string[];
  good: string;
  bad: string;
  soWhat: string;
}

const MILEAGE: Entry[] = [
  {
    name: 'Photon',
    meaning: 'How much attention the day took. One mile is twenty minutes of screen time.',
    accent: ACCENT_HEX.focus,
    direction: 'Neither good nor bad — it is a distance, like miles run.',
    madeOf: ['Every minute you were actually using a screen, divided by twenty.'],
    good: 'A normal day is somewhere between 5 and 25 miles.',
    bad: 'There is no bad number here. A big day is just a big day.',
    soWhat:
      'This is the raw amount. What matters is the split underneath it — the same 12 miles can be a good day or a rough one.',
  },
  {
    name: 'Focus miles',
    meaning: 'The part of your day spent properly stuck into something.',
    accent: ACCENT_HEX.focus,
    direction: 'More is better.',
    madeOf: ['Minutes inside a block of 25 minutes or more with nothing interrupting it.'],
    good: 'Half your miles or more.',
    bad: 'Almost none, on a day you were on screens for hours.',
    soWhat: 'This is the part of the day you will actually remember.',
  },
  {
    name: 'Scattered miles',
    meaning: 'Real time, spent in bits and pieces.',
    accent: ACCENT_HEX.jumpy,
    direction: 'Less is better.',
    madeOf: ['Minutes that were not in a long block and were not fast scrolling.'],
    good: 'A small slice. Some scattered time is normal and fine.',
    bad: 'Most of the day.',
    soWhat: 'Answering messages lives here. Useful, but it is not where things get finished.',
  },
  {
    name: 'Scroll miles',
    meaning: 'Time where things went past faster than you could read them.',
    accent: ACCENT_HEX.effort,
    direction: 'Less is better.',
    madeOf: ['Minutes where you scrolled faster than 1,400 pixels a second and typed almost nothing.'],
    good: 'Under a mile.',
    bad: 'Several miles, especially after 9pm.',
    soWhat: 'This is the number most people are surprised by. It is the clearest sign of time you did not choose to spend.',
  },
];

const SCORES: Entry[] = [
  {
    name: 'Screen Fitness',
    meaning: 'The one number for how well you are handling your screen time.',
    accent: ACCENT_HEX.gold,
    direction: 'Higher is better. Out of 100.',
    madeOf: [
      'Focus (counts most)',
      'Rest',
      'How steady you stayed',
      'Whether a hard day was matched by enough rest',
      'How your eyes did',
      'Whether the day went to plan, if you set one',
    ],
    good: '75 and up.',
    bad: 'Under 35.',
    soWhat:
      'It covers your last seven days, not just today — one rough day should not decide how you are doing. If you only look at one number, look at this one.',
  },
  {
    name: 'Focus',
    meaning: 'How long you stuck with one thing.',
    accent: ACCENT_HEX.focus,
    direction: 'Higher is better.',
    madeOf: [
      'How much of your time was in long blocks',
      'Your longest block',
      'How many long blocks you managed',
      'How often something interrupted them',
    ],
    good: '75+. Three long blocks in a day is a good rhythm.',
    bad: 'Under 35 — plenty of screen time, but nothing lasted.',
    soWhat: 'The easiest thing to improve. Protecting one 45-minute block changes the shape of a whole day.',
  },
  {
    name: 'Rest',
    meaning: 'How much of a break you actually got.',
    accent: ACCENT_HEX.rest,
    direction: 'Higher is better.',
    madeOf: [
      'How many breaks of 10 minutes or more you took',
      'Your longest time away',
      'Whether you left the evening alone',
      'Whether you ever let up during the day',
      'How hoppy the day was',
    ],
    good: '75+.',
    bad: 'Under 35 — long hours, few breaks, and the evening went on the screen too.',
    soWhat: 'A hard day is fine if you rested from it. A hard day with no rest is what piles up.',
  },
  {
    name: 'Effort',
    meaning: 'How hard the day was.',
    accent: ACCENT_HEX.effort,
    direction:
      'Lower is easier — but this one is not a score you are trying to win. A hard day of real work is meant to read as hard.',
    madeOf: [
      'How long you were on screen',
      'Your longest stretch without a break',
      'How busy your hands were',
      'Fast scrolling',
      'Jumping between things',
      'Time after 11pm',
    ],
    good: 'Under 25 is an easy day. 25–50 is a normal working day.',
    bad: 'Over 75 — you will probably feel this one tomorrow.',
    soWhat:
      'Only counts against your Screen Fitness where it was more than your Rest could cover. Work hard, rest properly, and this costs you nothing.',
  },
  {
    name: 'Eyes',
    meaning: 'How tired your eyes probably got.',
    accent: ACCENT_HEX.effort,
    direction: 'Lower is better.',
    madeOf: [
      'Your longest look without a break',
      'Total screen time',
      'How often you took breaks',
      'Evening screen time and how bright it was',
      'Fast-moving content',
    ],
    good: 'Under 25.',
    bad: 'Over 75 — the shape of a day that ends with a headache.',
    soWhat:
      'A good guess, not a doctor’s reading. We work out how much light is around you from your device’s sensor, or from one camera frame if you let us. Every 20 minutes, look at something far away for 20 seconds.',
  },
  {
    name: 'Jumpiness',
    meaning: 'How much you hopped between things.',
    accent: ACCENT_HEX.jumpy,
    direction: 'Lower is better.',
    madeOf: [
      'How often you jumped away, per hour',
      'How many visits were under five minutes',
      'How many times you came back to the screen',
      'Your average visit length',
    ],
    good: 'Under 25 — a calm day.',
    bad: 'Over 75 — nothing got a clear run.',
    soWhat:
      'The most useful number here. Getting your head fully back into something takes about 23 minutes, so a day of five-minute visits never reaches the part where hard things get solved.',
  },
  {
    name: 'On Plan',
    meaning: 'Whether the day went how you wanted it to.',
    accent: ACCENT_HEX.focus,
    direction: 'Higher is better.',
    madeOf: [
      'How much of what you planned actually happened',
      'How much time went somewhere you had not planned for',
    ],
    good: '75+.',
    bad: 'Under 35, or nothing planned at all.',
    soWhat:
      'Only appears once you set what you want from a day, in your profile. Without a plan there is nothing to compare, so we show no score rather than a zero you did not earn.',
  },
];

const OTHER: Entry[] = [
  {
    name: 'Time you got back',
    meaning: 'Time won back compared with a normal day for you.',
    accent: ACCENT_HEX.rest,
    direction: 'More is better.',
    madeOf: [
      'Less fast scrolling than usual',
      'Fewer scattered minutes than usual',
      'Less time after 11pm than usual',
    ],
    good: 'Any positive number.',
    bad: 'It never goes negative. A heavier day simply adds nothing.',
    soWhat:
      'Focused time is never counted here. Getting less work done is not the same as getting time back, and counting it would reward you for avoiding things.',
  },
  {
    name: 'vs your usual',
    meaning: 'How today compares with a normal day like this one, for you.',
    accent: ACCENT_HEX.focus,
    direction: 'Green means better, amber means worse.',
    madeOf: [
      'The middle value from your last four weeks of similar days',
      'Weekdays and weekends counted separately',
    ],
    good: 'Green.',
    bad: 'Amber — worth a look, not worth worrying about.',
    soWhat:
      'Never compared with anyone else, ever. It needs about four similar days before it can say anything, and until then it says it is still learning.',
  },
];

function Card({ e }: { e: Entry }) {
  return (
    <article className="card p-4">
      <div className="flex items-baseline gap-2.5">
        <span className="h-2.5 w-2.5 shrink-0 rounded-pill" style={{ background: e.accent }} aria-hidden />
        <h3 className="text-[17px] font-bold tracking-tightest">{e.name}</h3>
      </div>

      <p className="mt-2 text-[14.5px] leading-relaxed text-ink-soft">{e.meaning}</p>
      <p className="mt-2 text-[13px] leading-relaxed text-ink-faint">{e.direction}</p>

      <p className="label mt-4 text-ink-faint">What goes into it</p>
      <ul className="mt-1.5 space-y-1">
        {e.madeOf.map((m) => (
          <li key={m} className="flex gap-2 text-[13px] leading-relaxed text-ink-soft">
            <span className="text-ink-faint">·</span>
            {m}
          </li>
        ))}
      </ul>

      <dl className="mt-4 grid gap-2 sm:grid-cols-2">
        <div className="panel px-3 py-2.5">
          <dt className="label text-rest-text">Looks good</dt>
          <dd className="mt-1 text-[13px] leading-snug text-ink-soft">{e.good}</dd>
        </div>
        <div className="panel px-3 py-2.5">
          <dt className="label text-effort">Worth a look</dt>
          <dd className="mt-1 text-[13px] leading-snug text-ink-soft">{e.bad}</dd>
        </div>
      </dl>

      <p className="mt-3.5 text-[13px] leading-relaxed text-ink-faint">{e.soWhat}</p>
    </article>
  );
}

function Section({ title, blurb, entries }: { title: string; blurb: string; entries: Entry[] }) {
  return (
    <section>
      <h2 className="display text-[19px]">{title}</h2>
      <p className="mt-1.5 text-[13.5px] leading-relaxed text-ink-faint">{blurb}</p>
      <div className="mt-4 grid gap-2.5 md:grid-cols-2">
        {entries.map((e) => (
          <Card key={e.name} e={e} />
        ))}
      </div>
    </section>
  );
}

export default function GuidePage() {
  return (
    <div className="mx-auto flex max-w-[760px] flex-col gap-9 pb-8">
      <header>
        <h1 className="display text-[28px]">What the numbers <span className="marked">mean</span></h1>
        <p className="mt-2.5 text-[14.5px] leading-relaxed text-ink-soft">
          Every number the app shows you, in plain words: what it means, what goes into it, which way
          is good, and whether it is worth doing anything about.
        </p>
        <p className="mt-3 text-[13px] leading-relaxed text-ink-faint">
          Short version: <span className="text-ink">Screen Fitness</span> is the one to look at.
          Everything else explains why it is what it is.
        </p>
      </header>

      <Section
        title="Miles"
        blurb="The base unit. One mile is twenty minutes on a screen — and every minute lands in exactly one of the three kinds below, so they always add back up to the total."
        entries={MILEAGE}
      />

      <Section
        title="The six scores"
        blurb="All out of 100. Tap any of them in the app to see exactly how that day's number was worked out."
        entries={SCORES}
      />

      <Section
        title="The comparisons"
        blurb="Always against your own past. There are no other people in this app."
        entries={OTHER}
      />

      <section className="card p-4">
        <h2 className="text-[17px] font-bold tracking-tightest">Two things worth knowing</h2>
        <div className="mt-3 space-y-3 text-[13.5px] leading-relaxed text-ink-faint">
          <p>
            <span className="text-ink">A high number is not always the goal.</span> Effort and Eyes
            are readings, not targets. A busy day of real work should read as busy. The app is not
            trying to get you to use screens less — it is trying to help you notice the difference
            between five hours that went somewhere and five hours that did not.
          </p>
          <p>
            <span className="text-ink">Nothing here is a diagnosis.</span> The Eyes score is a
            guess at how hard a day asked your eyes to work, based on how long you looked and how
            few breaks you took. It is not a statement about your eyes.
          </p>
        </div>
      </section>

      <p className="text-[12.5px] text-ink-faint">
        <Link href="/method" className="text-ink-faint underline underline-offset-2 hover:text-ink">
          How we work all this out
        </Link>{' '}
        ·{' '}
        <Link href="/welcome" className="text-ink-faint underline underline-offset-2 hover:text-ink">
          What Photon is for
        </Link>
      </p>
    </div>
  );
}
