'use client';

import { useEffect, useRef, useState } from 'react';
import { usePhoton, useLive } from '@/components/PhotonProvider';
import {
  BLOCK_LENGTHS,
  LOOK_AWAY_MIN,
  endBlock,
  outcomeOf,
  remainingMs,
  startBlock,
  touchToday,
} from '@/lib/mm/blocks';
import {
  disableReminder,
  dueForLookAway,
  enableReminder,
  fireLookAway,
  notificationsRefused,
  notificationsSupported,
  reminderOn,
} from '@/lib/mm/remind';
import { fmtClock, fmtMin } from '@/lib/mm/format';
import { ACCENT_HEX } from '@/components/ui/tokens';

/**
 * THE ONE BUTTON.
 *
 * Everything else on Today reports. This is the only control that does
 * something, and it is the interaction the whole Strava comparison rests on:
 * you say what you are about to do, then afterwards the measurement tells you
 * how it went. Without it the app can only ever be read.
 *
 * The card has three states and they are deliberately different shapes, so
 * which one you are in is obvious from across the room: an invitation, a
 * countdown, and a result.
 *
 * What it never shows is a score for the block. See lib/mm/blocks — pressing a
 * button must not be able to raise a number, or the number stops being about
 * your day.
 */
export default function FocusBlock() {
  const mm = usePhoton();
  const live = useLive();
  const { block, blocksToday } = mm;

  const [now, setNow] = useState(() => Date.now());
  const [choosing, setChoosing] = useState(false);
  const [reminders, setReminders] = useState(false);
  const lastNudge = useRef<number | null>(null);

  useEffect(() => setReminders(reminderOn()), [mm.state]);

  // One-second clock, only while something is actually counting down.
  useEffect(() => {
    if (!block) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [block]);

  // A block whose time is up ends itself, so the result appears without the
  // user having to come back and stop it.
  useEffect(() => {
    if (block && remainingMs(block, now) === 0) {
      endBlock(block.id);
      mm.refresh();
    }
  }, [block, now, mm]);

  /*
   * The eye-rest nudge, fired from measured engaged time rather than the clock.
   * `boutSec` is the current unbroken stretch, so a break resets it and the
   * reminder never arrives for work that was not done.
   */
  useEffect(() => {
    if (!reminders || !live?.engaged) return;
    const minutes = live.boutSec / 60;
    if (!dueForLookAway(minutes, lastNudge.current)) return;
    lastNudge.current = Date.now();
    void fireLookAway();
  }, [reminders, live?.engaged, live?.boutSec]);

  const done = blocksToday.map((b) => outcomeOf(b, now));
  const last = done[done.length - 1];

  // ── running ────────────────────────────────────────────────
  if (block) {
    const left = remainingMs(block, now);
    const through = 1 - left / (block.minutes * 60_000);
    const here = live?.engaged ?? false;

    return (
      <section className="card relative overflow-hidden p-5">
        <div
          className="absolute inset-x-0 top-0 h-[3px] transition-[width] duration-1000 ease-linear"
          style={{ width: `${Math.min(100, through * 100)}%`, background: ACCENT_HEX.focus }}
          aria-hidden
        />
        <p className="label text-ink-faint">
          {block.label ? block.label : 'Block running'}
        </p>
        <p className="display mt-1.5 text-[42px] tabular-nums leading-none">
          {fmtClock(Math.round(left / 1000))}
        </p>
        <p className="mt-2.5 text-[13px] leading-relaxed text-ink-soft">
          {here
            ? `Left of your ${fmtMin(block.minutes)}. We are counting the minutes you are actually here.`
            : 'The clock is running, but nothing is happening on screen. That is fine — it counts what it sees.'}
        </p>
        <button
          type="button"
          onClick={() => {
            endBlock(block.id);
            mm.refresh();
          }}
          className="btn mt-4"
        >
          Stop here
        </button>
        <p className="mt-2.5 text-[12px] leading-relaxed text-ink-faint">
          Stopping early costs you nothing. There is no streak to break.
        </p>
      </section>
    );
  }

  // ── just finished ──────────────────────────────────────────
  if (last && Date.now() - (last.block.endedAt ?? 0) < 20 * 60_000) {
    return (
      <section className="card p-5">
        <p className="label text-ink-faint">How that block went</p>
        <p className="mt-1.5 text-[16px] font-semibold leading-snug">{last.headline}</p>
        {last.longestGapMin >= 5 && last.kept && (
          <p className="mt-2 text-[13px] leading-relaxed text-ink-soft">
            The longest you were away in the middle of it was {fmtMin(last.longestGapMin)}.
          </p>
        )}
        <p className="mt-3 text-[12.5px] leading-relaxed text-ink-faint">
          This is not scored. Those minutes already count through Focus, the same as any others —
          deciding to do them does not earn extra.
        </p>
        <button type="button" onClick={() => setChoosing(true)} className="btn mt-4">
          Start another
        </button>
        {choosing && <Lengths onPick={(m) => { touchToday(); startBlock(m); setChoosing(false); mm.refresh(); }} />}
      </section>
    );
  }

  // ── the invitation ─────────────────────────────────────────
  return (
    <section className="card p-5">
      <p className="label text-ink-faint">Going to work on something?</p>
      <p className="mt-1.5 text-[16px] font-semibold leading-snug">Say so before you start.</p>
      <p className="mt-2 text-[13.5px] leading-relaxed text-ink-soft">
        Pick how long you mean to give it. Afterwards we will tell you how much of that you were
        really there for — which is the bit you cannot tell yourself afterwards.
      </p>

      {choosing ? (
        <Lengths onPick={(m) => { touchToday(); startBlock(m); setChoosing(false); mm.refresh(); }} />
      ) : (
        <button
          type="button"
          onClick={() => setChoosing(true)}
          className="mt-4 rounded-pill px-4 py-2 text-[14px] font-semibold text-white"
          style={{ background: ACCENT_HEX.focus }}
        >
          Start a block
        </button>
      )}

      {done.length > 0 && (
        <p className="mt-3.5 text-[12.5px] text-ink-faint">
          {done.filter((d) => d.kept).length} of {done.length} today.
        </p>
      )}

      <ReminderToggle on={reminders} onChange={setReminders} refresh={mm.refresh} />
    </section>
  );
}

function Lengths({ onPick }: { onPick: (minutes: number) => void }) {
  return (
    <div className="mt-4 flex flex-wrap gap-2">
      {BLOCK_LENGTHS.map((m) => (
        <button
          key={m}
          type="button"
          onClick={() => onPick(m)}
          className="rounded-pill border border-ink/20 px-4 py-2 text-[14px] font-semibold transition-colors hover:border-ink/50"
        >
          {m} min
        </button>
      ))}
    </div>
  );
}

/**
 * The reminder switch lives here rather than in settings, because this is where
 * a person is already thinking about a stretch of work — and because it is the
 * only notification the app has, so it does not need a page of its own.
 */
function ReminderToggle({
  on,
  onChange,
  refresh,
}: {
  on: boolean;
  onChange: (v: boolean) => void;
  refresh: () => void;
}) {
  if (!notificationsSupported()) return null;

  if (notificationsRefused() && !on) {
    return (
      <p className="mt-4 border-t border-ink/10 pt-3.5 text-[12.5px] leading-relaxed text-ink-faint">
        You have turned off notifications for this site, so we cannot remind you to look away. Your
        browser settings can turn them back on.
      </p>
    );
  }

  return (
    <div className="mt-4 flex items-start justify-between gap-4 border-t border-ink/10 pt-3.5">
      <div>
        <p className="text-[13.5px] font-semibold">Remind me to look away</p>
        <p className="mt-1 text-[12.5px] leading-relaxed text-ink-faint">
          One nudge after every {LOOK_AWAY_MIN} minutes of screen. Look at something far off for
          twenty seconds — that is the whole thing, and it is the only message we will ever send.
        </p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-label="Remind me to look away"
        onClick={async () => {
          if (on) {
            disableReminder();
            onChange(false);
          } else {
            onChange(await enableReminder());
          }
          refresh();
        }}
        className="relative mt-0.5 h-6 w-11 shrink-0 rounded-pill border border-ink/20 transition-colors"
        style={{ background: on ? ACCENT_HEX.rest : 'transparent' }}
      >
        <span
          className="absolute top-[3px] h-4 w-4 rounded-full bg-paper shadow transition-[left]"
          style={{ left: on ? 24 : 3 }}
        />
      </button>
    </div>
  );
}
