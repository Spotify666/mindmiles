/**
 * Edge cases for the measurement layer.
 *
 * Everything here is a day that a real user can produce and that used to come
 * out wrong: a tab left open and glanced at all day, a phone session logged on
 * top of laptop time, a corrupted figure in localStorage, a day with nothing in
 * it at all. Each section names the behaviour it protects.
 *
 * Run with `npm test`.
 */
import { summarizeDay, RECOVERY_CAP_MIN } from '../lib/mm/aggregate';
import { Baseline, MIN_BASELINE_DAYS } from '../lib/mm/baseline';
import { evaluateChallenges } from '../lib/mm/challenges';
import { coachInsights, dayStory, oneThing } from '../lib/mm/coach';
import * as fmt from '../lib/mm/format';
import { buildDayReport, fitnessStatus } from '../lib/mm/metrics';
import { reclaimedTime, reclaimedHeadline } from '../lib/mm/reclaimed';
import { personalRecords, recordsSetOn } from '../lib/mm/records';
import { BLOCK_LENGTHS, LOOK_AWAY_MIN, activeBlock, elapsedMin, remainingMs } from '../lib/mm/blocks';
import { dueForLookAway } from '../lib/mm/remind';
import { weekReview } from '../lib/mm/week';
import type { Block, DayRecord, DaySummary, MinuteBucket } from '../lib/mm/types';
import { check, clean, note, report, rng, section } from './harness';
import { logged, minute, NOW, PROFILE, record, run } from './fixtures';

const day = (d: DayRecord | undefined, date = '2026-09-01'): DaySummary =>
  summarizeDay(d, date, PROFILE, NOW);

// ───────────────────────────────────────────────────────────────
section('a day with nothing in it');
{
  const s = day(undefined);
  clean('empty summary', s);
  check('no time', s.activeMin === 0, s.activeMin);
  check('rate is zero, not divided by zero', s.switchRate === 0, s.switchRate);
  const r = buildDayReport(s);
  clean('empty report', r);
  for (const [id, m] of Object.entries(r.byId)) {
    check(`${id} still scores 0–100`, m.value >= 0 && m.value <= 100, m.value);
  }
  check('no fitness status without history', fitnessStatus([r]) === null);
  check('no insights invented', coachInsights({ today: r, history: [r], baseline: Baseline.from([]), profile: PROFILE } as never).length === 0);
}

// ───────────────────────────────────────────────────────────────
section('a tab left open and glanced at');
{
  // Half a minute of activity every three minutes, breakfast to midnight. The
  // gaps are under the five-minute tolerance, so this used to chain into one
  // "sixteen-hour unbroken session" where every minute counted as deep focus.
  const bs: MinuteBucket[] = [];
  for (let m = 480; m < 1440; m += 3) bs.push(minute(m, { a: 30_000 }));
  const s = day(record('2026-09-01', bs));
  note(`span ${s.bouts[0].spanMin}m, engaged ${Math.round(s.bouts[0].activeMin)}m`);
  check('not treated as continuous', s.bouts[0].continuous === false);
  check('earns no deep blocks', s.deepBouts === 0, s.deepBouts);
  check('no focus miles', s.miles.focus === 0, s.miles.focus);
  check('longest stretch is time spent, not time elapsed', s.longestBoutMin <= s.activeMin, `${s.longestBoutMin} vs ${s.activeMin}`);
}
{
  // The other side of the same rule: a real session with a coffee break in it
  // must stay one session.
  const s = day(record('2026-09-01', [...run(540, 570, { k: 40 }), ...run(574, 610, { k: 40 })]));
  check('a four-minute gap does not split a session', s.bouts.length === 1, s.bouts.length);
  check('still continuous', s.bouts[0].continuous === true);
  check('counts as deep', s.deepBouts === 1, s.deepBouts);
}

// ───────────────────────────────────────────────────────────────
section('a real working day');
{
  const s = day(record('2026-09-01', [...run(540, 645, { k: 40 }), ...run(690, 780, { k: 35 })]));
  check('two blocks', s.bouts.length === 2, s.bouts.length);
  check('both deep', s.deepBouts === 2, s.deepBouts);
  check('longest is 105 minutes', s.longestBoutMin === 105, s.longestBoutMin);
  check('nearly all of it is focus', s.miles.focus / s.miles.total > 0.95, `${s.miles.focus}/${s.miles.total}`);
  check('one 45-minute break', s.breakCount === 1 && s.breaks[0].minutes === 45, s.breaks);
  const r = buildDayReport(s);
  check('Focus scores well', r.focus.value >= 70, `${r.focus.value} ${r.focus.headline}`);
}

// ───────────────────────────────────────────────────────────────
section('a phone session logged on top of laptop time');
{
  // Bouts overlap freely once hand-logged sessions are in play. Walking the
  // sorted list in pairs used to read the far side of an overlap as an empty
  // gap — an eight-hour "break" in the middle of eight hours of screen time.
  const s = day(
    record('2026-09-01', [...run(540, 1021), ...run(1080, 1141)], {
      externals: [logged({ start: new Date('2026-09-01T09:30:00').getTime(), minutes: 30 })],
    }),
  );
  check('no break invented inside screen time', s.breaks.every((b) => b.startMin >= 1021), s.breaks);
  check('the real gap survives', s.breakCount === 1 && s.breaks[0].minutes === 59, s.breaks);
  check('recovery mileage stays capped', s.miles.recovery <= RECOVERY_CAP_MIN / 20 + 0.001, s.miles.recovery);
}
{
  const s = day(record('2026-09-01', [], { externals: [logged({ start: new Date('2026-09-01T23:00:00').getTime(), minutes: 180 })] }));
  check('a session past midnight stays inside the day', s.bouts.every((b) => b.endMin <= 1439), s.bouts);
  check('and inside the clock', s.lastEngagedMin !== null && s.lastEngagedMin <= 1439, s.lastEngagedMin);
  check('logged time is counted', s.loggedMin === 180 && s.measuredMin === 0, `${s.loggedMin}/${s.measuredMin}`);
}

// ───────────────────────────────────────────────────────────────
section('a corrupted figure in storage');
{
  // localStorage is a text file the user can edit and an export they can
  // re-import. One bad number in there used to turn byHour into a 167-element
  // array and print "NaN" on the Today screen.
  const s = day(
    record('2026-09-01', [
      minute(600, { c: NaN, k: -50, s: -1000, v: -3, b: 400 }),
      minute(601, { a: -60_000 }),
      minute(9999),
      minute(-5),
      minute(700, { a: 999_999 }),
    ], { switches: -10 }),
  );
  clean('summary', s);
  check('one hour per hour', s.byHour.length === 24, s.byHour.length);
  check('counts never go negative', s.keys >= 0 && s.clicks >= 0 && s.scrollPx >= 0);
  check('rate never goes negative', s.switchRate >= 0, s.switchRate);
  check('brightness stays 0–100', s.avgBrightness >= 0 && s.avgBrightness <= 100, s.avgBrightness);
  clean('report', buildDayReport(s, { brightness: { known: true, measured: true } }));
}

// ───────────────────────────────────────────────────────────────
section('formatters never print NaN at the user');
{
  for (const v of [NaN, Infinity, -Infinity, -1, 0, 1e9]) {
    const shown = [
      fmt.fmtMiles(v), fmt.fmtMin(v), fmt.fmtClock(v), fmt.fmtDistance(v),
      fmt.fmtSigned(v), fmt.fmtCount(v), fmt.fmtPercent(v), fmt.fmtTimeOfDay(v),
    ];
    for (const out of shown) check(`nothing junk for ${v}`, !/NaN|Infinity|undefined/.test(out), out);
    check(`toMiles(${v}) is finite`, Number.isFinite(fmt.toMiles(v)));
  }
  check('a broken date reads as a dash', fmt.fmtDate('not-a-date') === '—', fmt.fmtDate('not-a-date'));
  check('median of nothing', fmt.median([]) === 0);
  check('mean ignores junk', fmt.mean([2, NaN, 4]) === 3, fmt.mean([2, NaN, 4]));
}

// ───────────────────────────────────────────────────────────────
section('too little history to compare against');
{
  const empty = Baseline.from([]);
  check('no normal', empty.normal('activeMin', '2026-09-01') === null);
  check('no comparison', empty.delta('activeMin', 100, 'lower-better', '2026-09-01') === undefined);
  check('not ready', empty.ready('2026-09-01') === false);
  clean('report against no baseline', buildDayReport(day(record('2026-09-01', run(600, 620))), { baseline: empty }));

  // One quiet day is not a normal. Presenting it as one produced "+1400%".
  const one = Baseline.from([day(record('2026-08-25', run(600, 620)), '2026-08-25')]);
  check('a single day is not settled', one.settled('activeMin', '2026-09-01') === null);
  check('but it still reports its own sample count', one.normal('activeMin', '2026-09-01')?.samples === 1);
  check('the threshold is stated once', MIN_BASELINE_DAYS >= 4);
}

// ───────────────────────────────────────────────────────────────
section('records, challenges and reclaimed time on thin data');
{
  check('no records from nothing', personalRecords([]).length === 0);
  check('nothing set today', recordsSetOn([], '2026-09-01').length === 0);

  const today = day(record('2026-09-05', run(600, 700)), '2026-09-05');
  check('today is still running', today.partial === true);
  check('a day still running sets no records', personalRecords([buildDayReport(today)]).length === 0);

  const r = reclaimedTime([], Baseline.from([]));
  clean('reclaimed', r);
  check('nothing claimed without a baseline', r.available === false && r.minutes === 0);
  check('and it says why, in words a child could read', /few more days/i.test(reclaimedHeadline(r)), reclaimedHeadline(r));
  check('and says it without jargon', !/baseline|metric|derive/i.test(reclaimedHeadline(r)), reclaimedHeadline(r));

  clean('challenges', evaluateChallenges([], {}, Baseline.from([]), PROFILE, 0, '2026-09-05'));
}

// ───────────────────────────────────────────────────────────────
section('brightness the app cannot read');
{
  const s = day(record('2026-09-01', run(540, 700, { b: 90 })));
  const unknown = buildDayReport(s, { brightness: { known: false, measured: false } });
  const known = buildDayReport(s, { brightness: { known: true, measured: true } });
  const dropped = (r: typeof unknown) => r.visual.inputs.filter((i) => i.provenance === 'unavailable').length;
  check('unknown brightness is left out rather than guessed', dropped(unknown) === dropped(known) + 1, `${dropped(unknown)} vs ${dropped(known)}`);
  check('and the score is still built', unknown.visual.value >= 0 && unknown.visual.value <= 100, unknown.visual.value);
  check('the card says so in words', unknown.visual.inputs.some((i) => /can.t read/i.test(i.value)), unknown.visual.inputs.map((i) => i.value));
}

// ───────────────────────────────────────────────────────────────
section('three hundred random days hold the invariants');
{
  const random = rng(20260905);
  for (let t = 0; t < 300; t++) {
    const bs: MinuteBucket[] = [];
    for (let i = 0, n = Math.floor(random() * 400); i < n; i++) {
      bs.push(minute(Math.floor(random() * 1440), {
        a: Math.floor(random() * 60_000), k: Math.floor(random() * 200),
        c: Math.floor(random() * 100), s: Math.floor(random() * 20_000),
        v: Math.floor(random() * 8000), x: Math.floor(random() * 4),
        b: Math.floor(random() * 100),
      }));
    }
    const externals = random() > 0.6 ? [logged({ minutes: Math.floor(random() * 400) })] : [];
    const s = day(record('2026-09-01', bs, { switches: Math.floor(random() * 300), externals }));

    if (junkOrFail(`day #${t}`, s)) break;
    check(`day #${t}: one hour per hour`, s.byHour.length === 24);
    check(`day #${t}: hours add up to the day`, Math.abs(s.byHour.reduce((a, b) => a + b, 0) - s.activeMin) < 2);
    check(`day #${t}: the three kinds of time add up`, Math.abs(s.miles.focus + s.miles.scatter + s.miles.scroll - s.miles.total) < 0.02);
    check(`day #${t}: longest stretch fits inside the day`, s.longestBoutMin <= s.activeMin + 1);
    check(`day #${t}: every block sits inside the clock`, s.bouts.every((b) => b.startMin >= 0 && b.endMin <= 1439 && b.endMin >= b.startMin));
    check(`day #${t}: no break overlaps screen time`, s.breaks.every((br) => s.bouts.every((b) => br.endMin < b.startMin || br.startMin > b.endMin)));

    const r = buildDayReport(s, { brightness: { known: random() > 0.5, measured: random() > 0.5 } });
    if (junkOrFail(`report #${t}`, r)) break;
    for (const [id, m] of Object.entries(r.byId)) {
      check(`day #${t}: ${id} scores 0–100`, m.value >= 0 && m.value <= 100, m.value);
    }
    const story = dayStory({ today: r, history: [r], baseline: Baseline.from([]), profile: PROFILE } as never);
    check(`day #${t}: the day reads as a sentence`, !/NaN|Infinity|undefined/.test(story), story);
    check(`day #${t}: one thing to do is a thing or nothing`, oneThing({ today: r, history: [r], baseline: Baseline.from([]), profile: PROFILE } as never) !== undefined);
  }
  note('300 random days checked');
}

section('blocks record an intention and score nothing');
{
  const now = new Date('2026-09-05T10:40:00').getTime();
  const started = new Date('2026-09-05T10:00:00').getTime();
  const block: Block = { id: 'b1', startedAt: started, minutes: 50, date: '2026-09-05' };

  check('a running block has time left', remainingMs(block, now) === 10 * 60_000, remainingMs(block, now));
  check('and time behind it', Math.round(elapsedMin(block, now)) === 40, elapsedMin(block, now));
  check('nothing left once it is up', remainingMs(block, started + 60 * 60_000) === 0);
  check('a block left running by a closed tab is not still going',
    activeBlock({ blocks: [block] } as never, started + 3 * 60 * 60_000) === null);
  check('but one inside its window is', activeBlock({ blocks: [block] } as never, now)?.id === 'b1');

  const stopped: Block = { ...block, endedAt: started + 12 * 60_000 };
  check('a block stopped early ran what it ran', Math.round(elapsedMin(stopped, now)) === 12, elapsedMin(stopped, now));
  check('lengths offered are sane', BLOCK_LENGTHS.every((m) => m >= 20 && m <= 120), BLOCK_LENGTHS.join());
  check('the eye-rest rule matches what the app preaches', LOOK_AWAY_MIN === 20, LOOK_AWAY_MIN);
}

section('the eye-rest nudge fires on time spent, not the clock');
{
  const t = new Date('2026-09-05T10:00:00').getTime();
  check('silent before twenty minutes', dueForLookAway(19, null) === false);
  check('fires at twenty', dueForLookAway(20, null) === true);
  check('does not fire again on the next tick', dueForLookAway(41, t, t + 60_000) === false);
  check('but does after another twenty', dueForLookAway(41, t, t + 21 * 60_000) === true);
  check('a break resets it', dueForLookAway(0, t, t + 60 * 60_000) === false);
}

section('the week reads as a review, not a score');
{
  const week = weekReview([], Baseline.from([]));
  clean('empty week', week);
  check('an empty week is not ready', week.ready === false);
  check('and says so plainly', /come back|only/i.test(week.headline), week.headline);
  check('with nothing to try yet', week.oneThing === null);
  check('and no score anywhere on it', !('score' in week));

  const days = ['08-30', '08-31', '09-01', '09-02', '09-03', '09-04', '09-05'].map((d) =>
    buildDayReport(day(record(`2026-${d}`, [...run(540, 645, { k: 40 }), ...run(700, 760)]), `2026-${d}`)),
  );
  const full = weekReview(days, Baseline.from(days.map((r) => r.summary)));
  clean('full week', full);
  check('a full week is ready', full.ready === true, full.days);
  check('the headline says what happened', full.headline.length > 20 && !/undefined|NaN/.test(full.headline), full.headline);
  check('it names a best day', full.bestDay !== null);
  check('and one thing to try', typeof full.oneThing === 'string', full.oneThing);
  check('the one thing is an action, not a scolding', !/less|stop using|too much/i.test(full.oneThing ?? ''), full.oneThing);
}

function junkOrFail(label: string, value: unknown): boolean {
  const before = process.exitCode;
  clean(label, value);
  return before !== process.exitCode;
}

report();
