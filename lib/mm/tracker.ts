'use client';

import { initBrightness, readBrightness, type BrightnessSource } from './brightness';
import { claimWriter, onPresenceChange, presence, releaseWriter, type PresenceSource } from './presence';
import { dayKey, ensureDay, getBucket, loadState, saveState } from './store';

/**
 * The measurement engine.
 *
 * What is genuinely measured here, by this browser, in this tab:
 *
 *   engaged time      the page is visible AND focused AND input has landed
 *                     inside the idle window. Time with the tab open and the
 *                     user gone is not screen time and is not counted.
 *   keystroke count   keydown fires; `event.key` is never read. There is no
 *                     code path in this file that touches the key value.
 *   pointer activity  click and tap counts.
 *   scroll            distance in CSS pixels, and peak velocity, which is what
 *                     separates reading from feed-flicking.
 *   context switches  every time focus or visibility leaves and comes back.
 *
 * Beyond this tab, three things extend the reach — all in ./presence:
 *
 *   With OS idle detection granted, engaged time keeps accruing while Mind
 *   Miles sits in the background, because we can tell you are still at your
 *   device. Input counts obviously do not: we cannot see what you typed in
 *   another app, and we never pretend to.
 *
 *   With the extension installed, time in other tabs arrives separately.
 *
 *   With several Photon tabs open, only one of them banks time.
 *
 * What is still NOT measured, and is never guessed at: which application or
 * site you were in, OS-level screen time, notification counts, and anything at
 * all about the content on your screen.
 */

/** No input for this long and the user is no longer engaged, tab open or not. */
const IDLE_MS = 60_000;
const TICK_MS = 1_000;
const FLUSH_MS = 10_000;
/** Away at least this long is a real break, and resets the unbroken-stretch clock. */
const BREAK_MS = 90_000;

/**
 * How much elapsed time a single tick may bank.
 *
 * These two numbers are the whole reason device-wide counting used to record
 * almost nothing. Browsers throttle `setInterval` in a background tab to about
 * once a minute, so with a flat three-second cap a full minute of real activity
 * banked three seconds — roughly a twentieth of the truth. The clock was
 * technically running and the numbers were nonsense.
 *
 * TAB: still tight. With the page hidden and no presence signal we have no idea
 * whether anyone was there, so a long gap must not be credited.
 *
 * DEVICE: generous, because idle detection is positive evidence the person was
 * at their machine for that whole stretch. Capped anyway — past five minutes,
 * assume the machine slept or the tab was frozen rather than inventing time.
 */
const CATCHUP_TAB_MS = TICK_MS * 3;
const CATCHUP_DEVICE_MS = 5 * 60_000;
/** Live waveform length — one sample per second. */
const WAVE_LEN = 60;
/**
 * Scroll faster than this and the content is moving past faster than it can be
 * read. It is the clearest single separator between reading and feed-scrolling.
 */
export const BURST_VELOCITY = 1400; // CSS px/s

export interface LiveStats {
  engaged: boolean;
  /** Engaged seconds accumulated since this page loaded. */
  sessionSec: number;
  keys: number;
  clicks: number;
  scrollPx: number;
  switches: number;
  /** ms since the last input of any kind. */
  idleFor: number;
  /** Seconds in the current unbroken stretch. */
  boutSec: number;
  /** Rolling keys per minute, over the last 60s. */
  kpm: number;
  /** Rolling clicks per minute, over the last 60s. */
  cpm: number;
  /** Rolling scroll pixels per minute, over the last 60s. */
  spm: number;
  /** Peak scroll velocity in the last 60s, CSS px/s. */
  peakVelocity: number;
  /** True while scrolling faster than content can be read. */
  bursting: boolean;
  /** How far our knowledge reaches right now: this tab, or the whole device. */
  presenceSource: PresenceSource;
  /** True when OS-level idle detection is running. */
  deviceAware: boolean;
  /** False when another Photon tab is the one banking time. */
  writing: boolean;
  /** Last 60 one-second activity samples, 0–1, oldest first. */
  wave: number[];
  brightness: number;
  brightnessSource: BrightnessSource;
  lux?: number;
}

type Listener = (s: LiveStats) => void;

class Tracker {
  private running = false;
  private lastInput = Date.now();
  private lastTick = Date.now();
  private lastFlush = Date.now();
  private lastScrollY = 0;
  private lastScrollAt = Date.now();

  private sessionMs = 0;
  private keys = 0;
  private clicks = 0;
  private scrollPx = 0;
  private switches = 0;

  // Deltas since the last tick, folded into the minute bucket each second.
  private pKeys = 0;
  private pClicks = 0;
  private pScroll = 0;
  private pSwitches = 0;
  private pPeakV = 0;

  // Live-only state, never persisted.
  private boutStart: number | null = null;
  private awaySince: number | null = null;
  private wave: number[] = new Array(WAVE_LEN).fill(0);
  private keyWindow: number[] = new Array(WAVE_LEN).fill(0);
  private clickWindow: number[] = new Array(WAVE_LEN).fill(0);
  private scrollWindow: number[] = new Array(WAVE_LEN).fill(0);
  private velocityWindow: number[] = new Array(WAVE_LEN).fill(0);

  private brightness = 70;
  private brightnessSource: BrightnessSource = 'declared';
  private writing = true;
  private unsubPresence: (() => void) | null = null;
  private lux: number | undefined;
  private brightnessBusy = false;

  private timer: ReturnType<typeof setInterval> | null = null;
  private listeners = new Set<Listener>();

  // ── lifecycle ────────────────────────────────────────────────

  start() {
    if (this.running || typeof window === 'undefined') return;
    this.running = true;

    const now = Date.now();
    this.lastInput = now;
    this.lastTick = now;
    this.lastScrollAt = now;
    this.lastScrollY = window.scrollY;
    this.brightness = loadState().brightness;

    initBrightness();

    window.addEventListener('keydown', this.onKey, { passive: true });
    window.addEventListener('pointerdown', this.onClick, { passive: true });
    window.addEventListener('scroll', this.onScroll, { passive: true });
    window.addEventListener('pointermove', this.onMove, { passive: true });
    window.addEventListener('wheel', this.onMove, { passive: true });
    // In-app navigation is a context change even though the tab never blurs.
    window.addEventListener('popstate', this.onSwitch);
    document.addEventListener('visibilitychange', this.onVisibility);
    window.addEventListener('blur', this.onSwitch);
    window.addEventListener('pagehide', this.flush);

    // A presence change (screen locked, user went idle at OS level) should
    // reach the UI immediately rather than on the next tick.
    this.unsubPresence = onPresenceChange(() => this.emit());

    this.timer = setInterval(this.tick, TICK_MS);
  }

  stop() {
    if (!this.running) return;
    this.running = false;
    this.flush();

    window.removeEventListener('keydown', this.onKey);
    window.removeEventListener('pointerdown', this.onClick);
    window.removeEventListener('scroll', this.onScroll);
    window.removeEventListener('pointermove', this.onMove);
    window.removeEventListener('wheel', this.onMove);
    window.removeEventListener('popstate', this.onSwitch);
    document.removeEventListener('visibilitychange', this.onVisibility);
    window.removeEventListener('blur', this.onSwitch);
    window.removeEventListener('pagehide', this.flush);

    this.unsubPresence?.();
    this.unsubPresence = null;
    releaseWriter();

    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  get isRunning(): boolean {
    return this.running;
  }

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    fn(this.snapshot());
    return () => {
      this.listeners.delete(fn);
    };
  }

  /** Called when the user moves the declared-brightness control. */
  setDeclaredBrightness(v: number) {
    if (this.brightnessSource === 'declared') this.brightness = v;
  }

  // ── input handlers ───────────────────────────────────────────
  // Only counters move. No handler reads an event payload.

  private onKey = () => {
    this.lastInput = Date.now();
    this.keys++;
    this.pKeys++;
  };

  private onClick = () => {
    this.lastInput = Date.now();
    this.clicks++;
    this.pClicks++;
  };

  private onMove = () => {
    this.lastInput = Date.now();
  };

  private onScroll = () => {
    const now = Date.now();
    this.lastInput = now;

    const y = window.scrollY;
    const distance = Math.abs(y - this.lastScrollY);
    this.lastScrollY = y;

    // Velocity over the gap since the previous scroll event. Sub-16ms gaps are
    // clamped so a burst of events in one frame cannot report absurd speeds.
    const gapMs = Math.max(16, now - this.lastScrollAt);
    this.lastScrollAt = now;
    const velocity = (distance / gapMs) * 1000;
    if (velocity > this.pPeakV) this.pPeakV = velocity;

    this.scrollPx += distance;
    this.pScroll += distance;
  };

  private onVisibility = () => {
    if (document.visibilityState === 'visible') {
      const now = Date.now();
      this.lastInput = now;

      /*
       * Coming back to the tab used to reset the clock outright, on the reasoning
       * that time away should not be billed to the returning minute. That is
       * right when this page is all we can see — and exactly wrong once idle
       * detection is on, because then the time away is the very thing we were
       * asked to count. It threw away every background minute at the moment the
       * user returned to look at it.
       *
       * So: bank what presence says we earned, then reset.
       */
      const p = presence(false);
      if (p.deviceAware && p.active && this.writing) {
        const elapsed = Math.min(now - this.lastTick, CATCHUP_DEVICE_MS);
        if (elapsed > TICK_MS) this.sessionMs += this.bankSpan(now - elapsed, now);
      }
      this.lastTick = now;
    } else {
      this.onSwitch();
    }
  };

  private onSwitch = () => {
    this.switches++;
    this.pSwitches++;
  };

  // ── the clock ────────────────────────────────────────────────

  /** Engagement as seen from inside this tab: visible, focused, recently touched. */
  private tabEngaged(): boolean {
    if (typeof document === 'undefined') return false;
    if (document.visibilityState !== 'visible') return false;
    if (document.hasFocus && !document.hasFocus()) return false;
    return Date.now() - this.lastInput < IDLE_MS;
  }

  /**
   * Whether to count this second at all.
   *
   * With device awareness on, this is a question about the person rather than
   * about the page — you can be working in another window and still be
   * engaged. Without it, the tab is all we can honestly see.
   */
  private engagedNow(): boolean {
    return presence(this.tabEngaged()).active;
  }

  private refreshBrightness() {
    if (this.brightnessBusy) return;
    this.brightnessBusy = true;
    // null when the user has never set one, so the reading comes back `unset`
    // rather than dressing a default up as their answer.
    readBrightness(loadState().brightnessSet ? loadState().brightness : null)
      .then((r) => {
        this.brightness = r.value;
        this.brightnessSource = r.source;
        this.lux = r.lux;
      })
      .catch(() => {})
      .finally(() => {
        this.brightnessBusy = false;
      });
  }

  /**
   * Bank a span of engaged time across the minutes it actually covers.
   *
   * The old code added the whole elapsed span to whichever minute happened to be
   * current when the tick fired. At one tick a second that was harmless; catching
   * up a throttled minute it would have dumped sixty seconds into a single
   * bucket, inventing one very busy minute and fifty-nine empty ones. Bouts,
   * breaks and the timeline are all built from those buckets, so the shape of the
   * day would have been wrong, not just the total.
   */
  private bankSpan(fromMs: number, toMs: number): number {
    if (toMs <= fromMs) return 0;

    const state = loadState();
    let banked = 0;
    let cursor = fromMs;

    // Walk minute boundary to minute boundary, so each bucket gets only its own
    // share and a span crossing midnight lands in the right day.
    while (cursor < toMs) {
      const at = new Date(cursor);
      const minuteEnd = new Date(cursor);
      minuteEnd.setSeconds(60, 0);
      const sliceEnd = Math.min(minuteEnd.getTime(), toMs);
      const slice = sliceEnd - cursor;

      const day = ensureDay(state, dayKey(at));
      const bucket = getBucket(day, at.getHours() * 60 + at.getMinutes(), this.brightness);
      bucket.a = Math.min(60_000, bucket.a + slice);
      bucket.b = this.brightness;

      banked += slice;
      cursor = sliceEnd;
    }

    saveState(state);
    return banked;
  }

  private tick = () => {
    const now = Date.now();
    const p = presence(this.tabEngaged());

    // How far back this tick is allowed to reach. See CATCHUP_* above.
    const cap = p.deviceAware ? CATCHUP_DEVICE_MS : CATCHUP_TAB_MS;
    const elapsed = Math.min(now - this.lastTick, cap);
    const spanStart = now - elapsed;
    this.lastTick = now;

    const engaged = p.active;

    // Unbroken-stretch clock. A long enough absence resets it; a short one does not.
    if (engaged) {
      if (this.awaySince !== null && now - this.awaySince >= BREAK_MS) this.boutStart = null;
      this.awaySince = null;
      if (this.boutStart === null) this.boutStart = now;
    } else if (this.awaySince === null) {
      this.awaySince = now;
    }

    const keysThisTick = this.pKeys;
    const clicksThisTick = this.pClicks;
    const scrollThisTick = this.pScroll;
    const switchesThisTick = this.pSwitches;
    const peakVThisTick = this.pPeakV;

    // A saturating mix of the three input channels, for the live waveform only.
    const level = engaged
      ? Math.min(1, keysThisTick / 6 + clicksThisTick / 2 + scrollThisTick / 600 + 0.08)
      : 0;

    const push = (arr: number[], v: number) => {
      arr.push(v);
      if (arr.length > WAVE_LEN) arr.shift();
    };
    push(this.wave, level);
    push(this.keyWindow, keysThisTick);
    push(this.clickWindow, clicksThisTick);
    push(this.scrollWindow, scrollThisTick);
    push(this.velocityWindow, peakVThisTick);

    this.refreshBrightness();

    // Only one Photon tab banks time. Everyone else keeps their own live
    // readout and writes nothing, so an open second tab cannot double the day.
    this.writing = claimWriter();

    // Switches are recorded whether or not the tab is engaged — leaving is the
    // event, and it necessarily happens while the tab is not in focus.
    if (this.writing && (engaged || switchesThisTick > 0)) {
      // Time first, spread over the minutes it belongs to.
      if (engaged) this.sessionMs += this.bankSpan(spanStart, now);

      // Then the counts, which can only ever belong to the minute we are in —
      // input is observed live, so there is nothing to catch up.
      const state = loadState();
      const d = new Date();
      const day = ensureDay(state, dayKey(d));
      const bucket = getBucket(day, d.getHours() * 60 + d.getMinutes(), this.brightness);

      if (switchesThisTick > 0) {
        day.switches += switchesThisTick;
        bucket.x += switchesThisTick;
      }

      if (engaged) {
        bucket.k += keysThisTick;
        bucket.c += clicksThisTick;
        bucket.s += Math.round(scrollThisTick);
        if (peakVThisTick > bucket.v) bucket.v = Math.round(peakVThisTick);
      }

      if (now - this.lastFlush > FLUSH_MS) {
        saveState(state);
        this.lastFlush = now;
      }
    }

    this.pKeys = 0;
    this.pClicks = 0;
    this.pScroll = 0;
    this.pSwitches = 0;
    this.pPeakV = 0;

    this.emit();
  };

  private flush = () => {
    saveState(loadState());
    this.lastFlush = Date.now();
  };

  private snapshot(): LiveStats {
    const p = presence(this.tabEngaged());
    const engaged = p.active;
    const sum = (a: number[]) => a.reduce((s, n) => s + n, 0);
    const peakVelocity = Math.round(Math.max(0, ...this.velocityWindow));

    return {
      engaged,
      sessionSec: Math.round(this.sessionMs / 1000),
      keys: this.keys,
      clicks: this.clicks,
      scrollPx: Math.round(this.scrollPx),
      switches: this.switches,
      idleFor: Date.now() - this.lastInput,
      boutSec:
        engaged && this.boutStart !== null ? Math.round((Date.now() - this.boutStart) / 1000) : 0,
      kpm: sum(this.keyWindow),
      cpm: sum(this.clickWindow),
      spm: Math.round(sum(this.scrollWindow)),
      peakVelocity,
      bursting: peakVelocity >= BURST_VELOCITY,
      wave: [...this.wave],
      brightness: this.brightness,
      brightnessSource: this.brightnessSource,
      lux: this.lux,
      presenceSource: p.source,
      deviceAware: p.deviceAware,
      writing: this.writing,
    };
  }

  private emit() {
    const s = this.snapshot();
    this.listeners.forEach((fn) => fn(s));
  }
}

/** Held on globalThis so hot reload in development does not reset the clock. */
const g = globalThis as unknown as { __photonTracker?: Tracker };

export function tracker(): Tracker {
  if (!g.__photonTracker) g.__photonTracker = new Tracker();
  return g.__photonTracker;
}
