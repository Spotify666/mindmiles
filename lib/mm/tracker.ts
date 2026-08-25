'use client';

import { initBrightness, readBrightness, type BrightnessSource } from './brightness';
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
 * What is NOT measured, and is never guessed at: other applications, other
 * tabs, other devices, OS-level screen time, notification counts, and anything
 * about the content on screen. Those are logged by hand or marked unavailable.
 */

/** No input for this long and the user is no longer engaged, tab open or not. */
const IDLE_MS = 60_000;
const TICK_MS = 1_000;
const FLUSH_MS = 10_000;
/** Away at least this long is a real break, and resets the unbroken-stretch clock. */
const BREAK_MS = 90_000;
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
      // Do not bill the away time to the returning minute.
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

  private engagedNow(): boolean {
    if (typeof document === 'undefined') return false;
    if (document.visibilityState !== 'visible') return false;
    if (document.hasFocus && !document.hasFocus()) return false;
    return Date.now() - this.lastInput < IDLE_MS;
  }

  private refreshBrightness() {
    if (this.brightnessBusy) return;
    this.brightnessBusy = true;
    readBrightness(loadState().brightness)
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

  private tick = () => {
    const now = Date.now();
    // Cap the delta so a laptop waking from sleep cannot bill hours to one minute.
    const delta = Math.min(now - this.lastTick, TICK_MS * 3);
    this.lastTick = now;

    const engaged = this.engagedNow();

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

    // Switches are recorded whether or not the tab is engaged — leaving is the
    // event, and it necessarily happens while the tab is not in focus.
    if (engaged || switchesThisTick > 0) {
      const d = new Date();
      const state = loadState();
      const day = ensureDay(state, dayKey(d));
      const minuteOfDay = d.getHours() * 60 + d.getMinutes();
      const bucket = getBucket(day, minuteOfDay, this.brightness);

      if (switchesThisTick > 0) {
        day.switches += switchesThisTick;
        bucket.x += switchesThisTick;
      }

      if (engaged) {
        this.sessionMs += delta;
        bucket.a = Math.min(60_000, bucket.a + delta);
        bucket.b = this.brightness;
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
    const engaged = this.engagedNow();
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
    };
  }

  private emit() {
    const s = this.snapshot();
    this.listeners.forEach((fn) => fn(s));
  }
}

/** Held on globalThis so hot reload in development does not reset the clock. */
const g = globalThis as unknown as { __mindMilesTracker?: Tracker };

export function tracker(): Tracker {
  if (!g.__mindMilesTracker) g.__mindMilesTracker = new Tracker();
  return g.__mindMilesTracker;
}
