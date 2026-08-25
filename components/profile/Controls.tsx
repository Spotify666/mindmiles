'use client';

import { useState } from 'react';
import {
  addExternal,
  clearAll,
  clearHistory,
  exportJson,
  setBrightness,
  setEnabled,
  setIntent,
  todayKey,
  updateProfile,
  updateSharing,
} from '@/lib/mm/store';
import { seedSampleHistory } from '@/lib/mm/seed';
import { tracker } from '@/lib/mm/tracker';
import { SOURCE_LABEL, SOURCE_NOTE, type BrightnessSource } from '@/lib/mm/brightness';
import { CATEGORIES, CATEGORY_LABEL, type Category, type MindMilesState } from '@/lib/mm/types';
import { fmtMin } from '@/lib/mm/format';

/**
 * The inputs the product cannot measure, and the controls over what it keeps.
 *
 * Two of these matter more than they look. Brightness is the only Visual Load
 * input a browser cannot read, so it is declared here and labelled as declared
 * everywhere it is used. And the data controls are deliberately plain and
 * unguarded: export is one tap, delete is one tap and a confirm, and neither is
 * buried behind a settings tree. A product holding this much behavioural detail
 * has no business making deletion difficult.
 */

export function BrightnessControl({
  value,
  source,
  onChange,
}: {
  value: number;
  source: BrightnessSource;
  onChange: (v: number) => void;
}) {
  return (
    <section className="card p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="label text-chalk-30">Screen brightness</p>
        <span
          className={`label rounded-pill px-2 py-0.5 ${
            source === 'declared'
              ? 'border border-strain/25 bg-strain-dim text-strain'
              : 'border border-recovery/25 bg-recovery-dim text-recovery'
          }`}
        >
          {SOURCE_LABEL[source]}
        </span>
      </div>

      <div className="mt-3 flex items-center gap-4">
        <span className="readout w-[62px] text-[26px]">{value}%</span>
        <input
          type="range"
          min={0}
          max={100}
          step={5}
          value={value}
          disabled={source !== 'declared'}
          onChange={(e) => onChange(Number(e.target.value))}
          aria-label="Declared screen brightness"
          className="h-1.5 flex-1 cursor-pointer appearance-none rounded-pill bg-surface-inset accent-[#497CFD] disabled:cursor-not-allowed disabled:opacity-40"
        />
      </div>

      <p className="mt-3 text-[11.5px] leading-relaxed text-chalk-45">{SOURCE_NOTE[source]}</p>
    </section>
  );
}

export function IntentionsControl({
  state,
  onChange,
}: {
  state: MindMilesState;
  onChange: () => void;
}) {
  const today = todayKey();
  const intents = state.days[today]?.intents ?? {};
  const total = Object.values(intents).reduce<number>((s, v) => s + (v ?? 0), 0);

  const step = (cat: Category, delta: number) => {
    setIntent(today, cat, Math.max(0, (intents[cat] ?? 0) + delta));
    onChange();
  };

  return (
    <section className="card p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="label text-chalk-30">Today&rsquo;s intentions</p>
        <span className="text-[12.5px] text-chalk-45">{total > 0 ? fmtMin(total) : 'none set'}</span>
      </div>

      <p className="mt-2 text-[12.5px] leading-relaxed text-chalk-45">
        What you meant this day to contain. Intentionality compares this against what was measured —
        with nothing set, it stays unscored rather than showing a zero.
      </p>

      <ul className="mt-3.5 space-y-1.5">
        {CATEGORIES.map((cat) => {
          const v = intents[cat] ?? 0;
          return (
            <li key={cat} className="flex items-center gap-3">
              <span className={`flex-1 text-[13.5px] ${v > 0 ? 'text-chalk' : 'text-chalk-45'}`}>
                {CATEGORY_LABEL[cat]}
              </span>
              <div className="flex items-center gap-1.5">
                <Step label={`Less ${CATEGORY_LABEL[cat]}`} onClick={() => step(cat, -15)} disabled={v === 0}>
                  −
                </Step>
                <span className="w-[52px] text-right text-[13px] tabular-nums text-chalk-70">
                  {v > 0 ? fmtMin(v) : '—'}
                </span>
                <Step label={`More ${CATEGORY_LABEL[cat]}`} onClick={() => step(cat, 15)}>
                  +
                </Step>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function Step({
  children,
  onClick,
  disabled,
  label,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className="h-7 w-7 rounded-pill border border-hair text-[15px] leading-none text-chalk-70 transition-colors hover:border-hair-strong hover:text-chalk disabled:opacity-30"
    >
      {children}
    </button>
  );
}

export function ManualLog({ onAdd }: { onAdd: () => void }) {
  const [label, setLabel] = useState('');
  const [minutes, setMinutes] = useState(30);
  const [category, setCategory] = useState<Category>('entertainment');
  const [intensity, setIntensity] = useState<'passive' | 'moderate' | 'heavy'>('passive');
  const [brightness, setBright] = useState(80);

  return (
    <section className="card p-4">
      <p className="label text-chalk-30">Log time elsewhere</p>
      <p className="mt-2 text-[12.5px] leading-relaxed text-chalk-45">
        A browser cannot see other apps, other devices or your phone, and this product will not
        pretend otherwise. Time spent there is entered by hand and kept visibly separate from what
        was measured.
      </p>

      <form
        className="mt-3.5 space-y-2.5"
        onSubmit={(e) => {
          e.preventDefault();
          if (!label.trim() || minutes <= 0) return;
          addExternal({
            label: label.trim(),
            category,
            start: Date.now() - minutes * 60_000,
            minutes,
            brightness,
            intensity,
          });
          setLabel('');
          onAdd();
        }}
      >
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Phone — messages"
          aria-label="What were you doing"
          maxLength={40}
          className="w-full rounded-[12px] border border-hair bg-surface-inset px-3 py-2 text-[14px] placeholder:text-chalk-30 focus:border-focus focus:outline-none"
        />

        <div className="grid grid-cols-2 gap-2.5">
          <label className="block">
            <span className="label text-chalk-30">Minutes</span>
            <input
              type="number"
              min={1}
              max={720}
              value={minutes}
              onChange={(e) => setMinutes(Number(e.target.value))}
              className="mt-1 w-full rounded-[12px] border border-hair bg-surface-inset px-3 py-2 text-[14px] tabular-nums focus:border-focus focus:outline-none"
            />
          </label>
          <label className="block">
            <span className="label text-chalk-30">Category</span>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as Category)}
              className="mt-1 w-full rounded-[12px] border border-hair bg-surface-inset px-3 py-2 text-[14px] focus:border-focus focus:outline-none"
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {CATEGORY_LABEL[c]}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="label text-chalk-30">Intensity</span>
            <select
              value={intensity}
              onChange={(e) => setIntensity(e.target.value as typeof intensity)}
              className="mt-1 w-full rounded-[12px] border border-hair bg-surface-inset px-3 py-2 text-[14px] focus:border-focus focus:outline-none"
            >
              <option value="passive">Passive</option>
              <option value="moderate">Moderate</option>
              <option value="heavy">Heavy</option>
            </select>
          </label>
          <label className="block">
            <span className="label text-chalk-30">Brightness</span>
            <input
              type="number"
              min={0}
              max={100}
              step={5}
              value={brightness}
              onChange={(e) => setBright(Number(e.target.value))}
              className="mt-1 w-full rounded-[12px] border border-hair bg-surface-inset px-3 py-2 text-[14px] tabular-nums focus:border-focus focus:outline-none"
            />
          </label>
        </div>

        <button
          type="submit"
          className="w-full rounded-pill bg-focus px-4 py-2.5 text-[14px] font-[560] text-void transition-opacity hover:opacity-90"
        >
          Add session
        </button>
      </form>
    </section>
  );
}

export function DataControls({ state, onChange }: { state: MindMilesState; onChange: () => void }) {
  const [confirming, setConfirming] = useState(false);

  const download = () => {
    const blob = new Blob([exportJson()], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mind-miles-${todayKey()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <section className="card p-4">
      <p className="label text-chalk-30">Your data</p>

      <label className="mt-3.5 flex items-start justify-between gap-4">
        <span>
          <span className="text-[14px]">Measurement</span>
          <span className="mt-0.5 block text-[12px] leading-snug text-chalk-45">
            Switching this off stops recording immediately. Your history is kept.
          </span>
        </span>
        <input
          type="checkbox"
          checked={state.enabled}
          onChange={(e) => {
            setEnabled(e.target.checked);
            if (e.target.checked) tracker().start();
            else tracker().stop();
            onChange();
          }}
          className="mt-1 h-5 w-9 shrink-0 cursor-pointer appearance-none rounded-pill bg-surface-inset transition-colors checked:bg-recovery"
        />
      </label>

      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        <button
          type="button"
          onClick={download}
          className="rounded-pill border border-hair px-4 py-2 text-[13.5px] text-chalk-70 transition-colors hover:border-hair-strong hover:text-chalk"
        >
          Export everything
        </button>
        <button
          type="button"
          onClick={() => {
            clearHistory();
            onChange();
          }}
          className="rounded-pill border border-hair px-4 py-2 text-[13.5px] text-chalk-70 transition-colors hover:border-hair-strong hover:text-chalk"
        >
          Clear measured history
        </button>
        <button
          type="button"
          onClick={() => {
            seedSampleHistory(true);
            onChange();
          }}
          className="rounded-pill border border-hair px-4 py-2 text-[13.5px] text-chalk-45 transition-colors hover:border-hair-strong hover:text-chalk"
        >
          Regenerate sample history
        </button>

        {confirming ? (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                clearAll();
                setConfirming(false);
                onChange();
              }}
              className="flex-1 rounded-pill bg-strain px-4 py-2 text-[13.5px] font-[560] text-void"
            >
              Delete it all
            </button>
            <button
              type="button"
              onClick={() => setConfirming(false)}
              className="rounded-pill border border-hair px-4 py-2 text-[13.5px] text-chalk-45"
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setConfirming(true)}
            className="rounded-pill border border-strain/30 px-4 py-2 text-[13.5px] text-strain transition-colors hover:bg-strain-dim"
          >
            Delete everything
          </button>
        )}
      </div>

      <p className="mt-3.5 text-[11.5px] leading-relaxed text-chalk-30">
        Export gives you the complete raw record as JSON — every minute bucket, not a summary.
        Delete removes it from this device, which is the only place it exists.
      </p>
    </section>
  );
}

export function SharingControls({
  state,
  onChange,
}: {
  state: MindMilesState;
  onChange: () => void;
}) {
  const FIELDS = [
    ['fitness', 'Digital Fitness'],
    ['miles', 'Mind Miles'],
    ['records', 'Personal records'],
    ['challenges', 'Challenges completed'],
    ['reclaimed', 'Time reclaimed'],
    ['streak', 'Current streak'],
  ] as const;

  return (
    <section className="card p-4">
      <p className="label text-chalk-30">What a share card shows</p>
      <p className="mt-2 text-[12.5px] leading-relaxed text-chalk-45">
        Achievements only. A share card never contains a timeline, an app name, a site, a session, or
        anything about when you were awake.
      </p>

      <ul className="mt-3.5 space-y-2">
        {FIELDS.map(([key, label]) => (
          <li key={key}>
            <label className="flex items-center justify-between gap-4">
              <span className="text-[13.5px]">{label}</span>
              <input
                type="checkbox"
                checked={state.sharing[key]}
                onChange={(e) => {
                  updateSharing({ [key]: e.target.checked });
                  onChange();
                }}
                className="h-5 w-9 shrink-0 cursor-pointer appearance-none rounded-pill bg-surface-inset transition-colors checked:bg-recovery"
              />
            </label>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function ProfileControls({
  state,
  onChange,
}: {
  state: MindMilesState;
  onChange: () => void;
}) {
  return (
    <section className="card p-4">
      <p className="label text-chalk-30">You</p>
      <div className="mt-3.5 space-y-2.5">
        <label className="block">
          <span className="label text-chalk-30">Display name</span>
          <input
            value={state.profile.displayName}
            onChange={(e) => {
              updateProfile({ displayName: e.target.value.slice(0, 24) });
              onChange();
            }}
            className="mt-1 w-full rounded-[12px] border border-hair bg-surface-inset px-3 py-2 text-[14px] focus:border-focus focus:outline-none"
          />
        </label>

        <div className="grid grid-cols-2 gap-2.5">
          <label className="block">
            <span className="label text-chalk-30">Wake hour</span>
            <input
              type="number"
              min={0}
              max={23}
              value={state.profile.wakeHour}
              onChange={(e) => {
                updateProfile({ wakeHour: Math.max(0, Math.min(23, Number(e.target.value))) });
                onChange();
              }}
              className="mt-1 w-full rounded-[12px] border border-hair bg-surface-inset px-3 py-2 text-[14px] tabular-nums focus:border-focus focus:outline-none"
            />
          </label>
          <label className="block">
            <span className="label text-chalk-30">Screen curfew</span>
            <input
              type="number"
              min={0}
              max={23}
              value={state.profile.curfewHour}
              onChange={(e) => {
                updateProfile({ curfewHour: Math.max(0, Math.min(23, Number(e.target.value))) });
                onChange();
              }}
              className="mt-1 w-full rounded-[12px] border border-hair bg-surface-inset px-3 py-2 text-[14px] tabular-nums focus:border-focus focus:outline-none"
            />
          </label>
        </div>
      </div>
      <p className="mt-3 text-[11.5px] leading-relaxed text-chalk-30">
        These two hours anchor the Digital Sunrise and Digital Sunset measurements, and the evening
        protection input in Recovery. Nothing here is uploaded.
      </p>
    </section>
  );
}

export { setBrightness };
