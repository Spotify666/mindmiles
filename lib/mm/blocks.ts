import { dayKey, ensureDay, loadState, saveState, todayKey } from './store';
import { fmtMin } from './format';
import type { Block, BlockOutcome, DaySummary, PhotonState } from './types';

/**
 * BLOCKS — the part of this app you press.
 *
 * Everything else here watches. That is the right default: a tracker that
 * needs you to remember it is a tracker that measures the days you remembered
 * it. But watching alone leaves the product with nothing to DO, and the
 * comparison it invites — Strava for attention — is a comparison to an app
 * whose whole shape is a Record button.
 *
 * A block is you saying, in advance, "I am going to work on one thing for the
 * next fifty minutes." Nothing about the measurement changes: those minutes
 * were being counted anyway, at the same rate, by the same code. What changes
 * is that afterwards there is something to compare the minutes against, and
 * "you stayed with it for 43 of the 50" is a sentence the passive product
 * cannot say.
 *
 * Two rules keep it honest.
 *
 * A block cannot be failed. It ends when its time is up and it reports what
 * happened; there is no penalty, no lost streak, and no tree that dies. The
 * product does not have a way to punish you and this is not where it gets one.
 *
 * And a block scores nothing. It does not enter Screen Fitness, does not move
 * a metric, and does not set a record on its own. It is a plan, and a plan you
 * kept is already reported through Focus and On Plan, from measurement. Letting
 * an intention feed a score would mean pressing a button raised your numbers,
 * which is the exact failure mode of every habit app that counts check-ins.
 */

/** The lengths offered. Twenty-five is a pomodoro; fifty is two, joined up. */
export const BLOCK_LENGTHS = [25, 50, 90] as const;

/** How far into a block the eye-rest nudge fires, and how often after that. */
export const LOOK_AWAY_MIN = 20;

/** A block this far along counts as done rather than abandoned. */
const KEPT_SHARE = 0.8;

export function activeBlock(state: PhotonState, now = Date.now()): Block | null {
  const b = state.blocks?.find((x) => !x.endedAt);
  if (!b) return null;
  // A block left running by a closed tab is not a block that is still going.
  // Anything past twice its length is stale, and is closed where it is read.
  if (now - b.startedAt > b.minutes * 60_000 * 2) return null;
  return b;
}

export function remainingMs(block: Block, now = Date.now()): number {
  return Math.max(0, block.startedAt + block.minutes * 60_000 - now);
}

export function elapsedMin(block: Block, now = Date.now()): number {
  return Math.max(0, (Math.min(now, block.endedAt ?? now) - block.startedAt) / 60_000);
}

export function startBlock(minutes: number, label?: string): PhotonState {
  const state = loadState();
  const now = Date.now();
  // Starting a block while one runs replaces it rather than stacking, because
  // two overlapping blocks would both claim the same minutes.
  for (const b of state.blocks ?? []) if (!b.endedAt) b.endedAt = now;
  state.blocks = [
    ...(state.blocks ?? []),
    { id: `b${now.toString(36)}`, startedAt: now, minutes, label, date: dayKey(new Date(now)) },
  ].slice(-200);
  return saveState(state);
}

export function endBlock(id: string, now = Date.now()): PhotonState {
  const state = loadState();
  const block = state.blocks?.find((b) => b.id === id);
  if (block && !block.endedAt) block.endedAt = now;
  return saveState(state);
}

/**
 * What actually happened during a block, read back from the measured minutes.
 *
 * This is the whole point of the feature, and it is deliberately read from the
 * same buckets everything else uses rather than from anything the block itself
 * recorded. The block knows only when it started and how long it meant to run.
 * Whether you were there is a question for the measurement.
 */
export function outcomeOf(block: Block, now = Date.now()): BlockOutcome {
  const state = loadState();
  const day = state.days[block.date];
  const from = new Date(block.startedAt);
  const to = new Date(Math.min(block.endedAt ?? now, block.startedAt + block.minutes * 60_000));

  const startMin = from.getHours() * 60 + from.getMinutes();
  const endMin = to.getHours() * 60 + to.getMinutes();

  let present = 0;
  let jumps = 0;
  let longestGap = 0;
  let gap = 0;

  for (let m = startMin; m <= endMin && day; m++) {
    const bucket = day.buckets[String(m % 1440)];
    const engaged = (bucket?.a ?? 0) >= 20_000;
    if (engaged) {
      present += (bucket?.a ?? 0) / 60_000;
      jumps += bucket?.x ?? 0;
      gap = 0;
    } else {
      gap += 1;
      longestGap = Math.max(longestGap, gap);
    }
  }

  const planned = block.minutes;
  const ran = elapsedMin(block, now);
  const kept = ran >= planned * KEPT_SHARE;

  return {
    block,
    plannedMin: planned,
    ranMin: Math.round(ran),
    presentMin: Math.round(present),
    jumps,
    longestGapMin: longestGap,
    kept,
    /*
     * Said the way a person would say it. Never "adherence 86%", and never a
     * telling-off — a block that fell apart reports what happened and stops,
     * because the user already knows how it went and does not need it framed.
     */
    headline: !kept
      ? ran < 1
        ? `Stopped almost straight away. No harm done — try a shorter one.`
        : `Stopped after ${fmtMin(ran)} of ${fmtMin(planned)}. That happens.`
      : present >= planned * 0.9 && jumps === 0
        ? `You stayed with it the whole way. ${fmtMin(present)} of ${fmtMin(planned)}, nothing broke in.`
        : jumps === 0
          ? `${fmtMin(present)} of ${fmtMin(planned)} at the screen, and nothing interrupted you.`
          : `${fmtMin(present)} of ${fmtMin(planned)}, with ${jumps === 1 ? 'one jump' : `${jumps} jumps`} away.`,
  };
}

/** Finished blocks for a date, newest last. Used on Today and in the week review. */
export function blocksOn(state: PhotonState, date = todayKey()): Block[] {
  return (state.blocks ?? []).filter((b) => b.date === date && b.endedAt);
}

/**
 * How the day's blocks went, in one line.
 *
 * Counts blocks kept rather than minutes planned, because three fifty-minute
 * blocks and one long one are not the same day and the count is the part a
 * person remembers.
 */
export function blockSummary(state: PhotonState, summary: DaySummary): string | null {
  const done = blocksOn(state, summary.date);
  if (done.length === 0) return null;
  const kept = done.filter((b) => outcomeOf(b).kept).length;
  if (kept === 0) return `You started ${done.length === 1 ? 'a block' : `${done.length} blocks`} today. None ran their full length — worth trying a shorter one.`;
  const total = done.reduce((s, b) => s + outcomeOf(b).presentMin, 0);
  return `${kept === 1 ? 'One block' : `${kept} blocks`} you set out to do, ${fmtMin(total)} inside them.`;
}

/** Ensure today exists before a block writes into it, so the first block of a day works. */
export function touchToday(): void {
  const state = loadState();
  ensureDay(state, todayKey());
  saveState(state);
}
