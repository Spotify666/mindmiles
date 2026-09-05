'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Baseline } from '@/lib/mm/baseline';
import { summarizeDay } from '@/lib/mm/aggregate';
import { evaluateChallenges } from '@/lib/mm/challenges';
import { coachInsights, dayStory } from '@/lib/mm/coach';
import { buildDayReport, fitnessStatus } from '@/lib/mm/metrics';
import { acknowledgementMap, personalRecords } from '@/lib/mm/records';
import { reclaimedTime } from '@/lib/mm/reclaimed';
import { seedSampleHistory } from '@/lib/mm/seed';
import { listenForExtension, onExtensionData } from '@/lib/mm/extension';
import { resumeDeviceAwareness } from '@/lib/mm/presence';
import { setCameraReading } from '@/lib/mm/brightness';
import {
  acknowledgeRecords,
  isStorageBlocked,
  loadState,
  recentKeys,
  RETAIN_DAYS,
  setEnabled,
  todayKey,
} from '@/lib/mm/store';
import { tracker, type LiveStats } from '@/lib/mm/tracker';
import type {
  ChallengeProgress,
  DayReport,
  DaySummary,
  Insight,
  PhotonState,
  MetricId,
  Metric,
  PersonalRecord,
  Reclaimed,
} from '@/lib/mm/types';
import type { Block } from '@/lib/mm/types';
import { activeBlock, blocksOn, outcomeOf } from '@/lib/mm/blocks';
import { weekReview, type WeekReview } from '@/lib/mm/week';

/**
 * The single place the whole app gets its numbers.
 *
 * Every screen reads from here, and nothing recomputes metrics on its own. That
 * is worth the indirection for one reason: the arithmetic in lib/mm is the
 * product's claim to being honest, and it can only stay honest if there is
 * exactly one path from raw minutes to a number on screen.
 *
 * Recomputation runs on a slow tick rather than on every measured second. The
 * tracker updates live readouts at 1Hz through its own subscription; the
 * aggregate layer only needs to keep up with a person glancing at a screen.
 */

/** How often day aggregates are rebuilt while the app is open. */
const REBUILD_MS = 15_000;

interface PhotonValue {
  ready: boolean;
  state: PhotonState;
  /**
   * The live snapshot at the time the aggregates were last rebuilt. Fine for
   * things that change slowly — the brightness source, say. Anything showing a
   * ticking number must use `useLive()` instead.
   */
  live: LiveStats | null;
  storageBlocked: boolean;

  /** Last 90 days, oldest first. */
  summaries: DaySummary[];
  reports: DayReport[];
  byDate: Map<string, DayReport>;
  today: DayReport;

  baseline: Baseline;
  /** Trailing 7-day Digital Fitness — the headline status, not one day's score. */
  fitness: number;
  /**
   * The same figure as of 30 days ago. Null when there is no history that far
   * back, so the UI omits the "this month" comparison rather than inventing one
   * against a zero.
   */
  fitnessLastMonth: number | null;

  records: PersonalRecord[];
  challenges: ChallengeProgress[];
  reclaimedMonth: Reclaimed;
  reclaimedWeek: Reclaimed;
  insights: Insight[];
  story: string;
  /** Your week, the way the review page reads it. */
  week: WeekReview;
  /** The block running right now, if there is one. */
  block: Block | null;
  /** Blocks finished today, oldest first. */
  blocksToday: Block[];

  /** Re-read storage after a mutation. */
  refresh: () => void;
  /** Stop flagging the current records as new. */
  markRecordsSeen: () => void;
}

const Ctx = createContext<PhotonValue | null>(null);

/**
 * The live readout gets its own context, and this is not an optimisation — it
 * is a correctness fix.
 *
 * The tracker emits at 1Hz. Everything else on the screen is rebuilt from
 * ninety days of minute buckets and cannot be, so the aggregate value is
 * memoised on a slow tick. Putting `live` inside that memo meant the clock on
 * screen was whatever the tracker happened to be saying the last time the
 * aggregates were rebuilt — which is to say, 00:00, for fifteen seconds at a
 * time. The counters were recording correctly the whole time; the screen simply
 * was not being told.
 *
 * Two contexts: the heavy one changes rarely, the live one changes every
 * second, and only the components that actually show a live number subscribe to
 * it.
 */
const LiveCtx = createContext<LiveStats | null>(null);

export function useLive(): LiveStats | null {
  return useContext(LiveCtx);
}

export function usePhoton(): PhotonValue {
  const v = useContext(Ctx);
  if (!v) throw new Error('usePhoton must be used inside <PhotonProvider>');
  return v;
}

/** A metric for one id, for the explain sheet. */
export function useMetric(id: MetricId): Metric {
  return usePhoton().today.byId[id];
}

export default function PhotonProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<PhotonState | null>(null);
  const [live, setLive] = useState<LiveStats | null>(null);
  const [tick, setTick] = useState(0);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    seedSampleHistory();
    const s = loadState();
    // Measurement is opt-in, but a first run has already agreed to it by
    // arriving here — the privacy note on Today explains exactly what is
    // recorded, and Profile can switch it off without losing history.
    if (!s.enabled) setEnabled(true);
    setState({ ...loadState() });

    const t = tracker();
    t.start();
    const unsub = t.subscribe(setLive);

    // If OS idle detection was granted in a previous session, pick it back up
    // without prompting — the prompt needs a gesture, a resume does not.
    void resumeDeviceAwareness();

    // Likewise the last room-light reading, so a refresh does not cost someone
    // their camera again.
    if (s.roomLight) setCameraReading(s.roomLight.value, s.roomLight.at);

    // The extension, if one is installed, posts its totals into the page.
    const stopExtension = listenForExtension();
    const stopExtensionData = onExtensionData(() => setState({ ...loadState() }));

    const id = setInterval(() => setTick((n) => n + 1), REBUILD_MS);

    return () => {
      unsub();
      stopExtension();
      stopExtensionData();
      clearInterval(id);
    };
  }, []);

  const refresh = useCallback(() => setState({ ...loadState() }), []);

  const value = useMemo<PhotonValue | null>(() => {
    if (!state) return null;

    const today = todayKey();
    const keys = recentKeys(RETAIN_DAYS);

    // ── 1. raw days ────────────────────────────────────────────
    const summaries = keys.map((date) => summarizeDay(state.days[date], date, state.profile));

    // ── 2. metrics, in two passes ──────────────────────────────
    // The first pass produces metric values with no baseline attached; the
    // second builds a baseline that includes those values, so a metric can be
    // compared against its own history rather than only against raw minutes.
    const source = live?.brightnessSource ?? 'unset';
    /*
     * Two different questions, and they have different answers for the camera.
     *
     * `known` — is there a figure at all? Anything but `unset`.
     *
     * `measured` — is it precise enough to present as an observation? A native
     * plugin or a light sensor, yes. A camera frame, no: cameras auto-expose,
     * and it reads the room rather than the screen. So a camera reading counts
     * as real enough to score with and is labelled a best guess, which is what
     * it is. The control still calls it measured, because the distinction there
     * is "we took this" versus "you typed it" — a different question again.
     */
    const brightness = {
      known: source !== 'unset',
      measured: source === 'native' || source === 'sensor',
    };
    const firstPass = summaries.map((s) => buildDayReport(s, { brightness }));
    const metricsByDate: Record<string, Record<MetricId, Metric>> = Object.fromEntries(
      firstPass.map((r) => [r.date, r.byId]),
    );

    const baseline = Baseline.from(summaries, metricsByDate);
    const reports = summaries.map((s) => buildDayReport(s, { baseline, brightness }));
    const byDate = new Map(reports.map((r) => [r.date, r]));

    const todayReport = byDate.get(today) ?? reports[reports.length - 1];

    // ── 3. status, achievement, coaching ───────────────────────
    const fitness = fitnessStatus(reports) ?? 0;
    const fitnessLastMonth = fitnessStatus(reports.slice(0, Math.max(1, reports.length - 30)));

    const records = personalRecords(reports, state.seenRecords);

    const last30 = summaries.slice(-30);
    const last7 = summaries.slice(-7);
    const reclaimedMonth = reclaimedTime(last30, baseline);
    const reclaimedWeek = reclaimedTime(last7, baseline);

    const challenges = evaluateChallenges(
      reports,
      state.challenges,
      baseline,
      state.profile,
      reclaimedWeek.minutes,
      today,
    );

    const history = reports.filter((r) => r.date < today);
    const coachCtx = { today: todayReport, history, baseline, profile: state.profile };
    const insights = coachInsights(coachCtx);
    const story = dayStory(coachCtx);

    const keptThisWeek = reports
      .slice(-7)
      .reduce((n, r) => n + blocksOn(state, r.date).filter((b) => outcomeOf(b).kept).length, 0);
    const week = weekReview(reports, baseline, keptThisWeek, records);

    return {
      ready: true,
      state,
      live,
      storageBlocked: isStorageBlocked(),
      summaries,
      reports,
      byDate,
      today: todayReport,
      baseline,
      fitness,
      fitnessLastMonth,
      records,
      challenges,
      reclaimedMonth,
      reclaimedWeek,
      insights,
      story,
      week,
      block: activeBlock(state),
      blocksToday: blocksOn(state, today),
      refresh,
      markRecordsSeen: () => {
        acknowledgeRecords(acknowledgementMap(records));
        refresh();
      },
    };
    // `tick` is the rebuild trigger; `live` is included only for its brightness
    // source, which changes at most once per session.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, tick, live?.brightnessSource, refresh]);

  if (!value) {
    return (
      <div className="flex min-h-[100svh] items-center justify-center">
        <p className="label animate-breathe text-ink-faint">Reading your device</p>
      </div>
    );
  }

  return (
    <Ctx.Provider value={value}>
      <LiveCtx.Provider value={live}>{children}</LiveCtx.Provider>
    </Ctx.Provider>
  );
}
