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
import { CATEGORIES, CATEGORY_LABEL, type Category, type PhotonState } from '@/lib/mm/types';
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
        <p className="label text-ink-faint">How bright is your screen?</p>
        <span
          className={`label rounded-pill px-2 py-0.5 ${
            source === 'declared'
              ? 'border border-effort/40 bg-effort-wash text-effort'
              : 'border border-rest/40 bg-rest-wash text-rest-text'
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
          className="h-1.5 flex-1 cursor-pointer appearance-none rounded-pill bg-paper accent-[#497CFD] disabled:cursor-not-allowed disabled:opacity-40"
        />
      </div>

      <p className="mt-3 text-[11.5px] leading-relaxed text-ink-faint">{SOURCE_NOTE[source]}</p>
    </section>
  );
}

export function IntentionsControl({
  state,
  onChange,
}: {
  state: PhotonState;
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
        <p className="label text-ink-faint">What do you want from today?</p>
        <span className="text-[12.5px] text-ink-faint">{total > 0 ? fmtMin(total) : 'none set'}</span>
      </div>

      <p className="mt-2 text-[12.5px] leading-relaxed text-ink-faint">
        Set roughly how you want to spend today. We compare it with what actually happens. Leave it
        blank and we simply do not score it.
      </p>

      <ul className="mt-3.5 space-y-1.5">
        {CATEGORIES.map((cat) => {
          const v = intents[cat] ?? 0;
          return (
            <li key={cat} className="flex items-center gap-3">
              <span className={`flex-1 text-[13.5px] ${v > 0 ? 'text-ink' : 'text-ink-faint'}`}>
                {CATEGORY_LABEL[cat]}
              </span>
              <div className="flex items-center gap-1.5">
                <Step label={`Less ${CATEGORY_LABEL[cat]}`} onClick={() => step(cat, -15)} disabled={v === 0}>
                  −
                </Step>
                <span className="w-[52px] text-right text-[13px] tabular-nums text-ink-soft">
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
      className="h-7 w-7 rounded-pill border border-ink/15 text-[15px] leading-none text-ink-soft transition-colors hover:border-ink hover:text-ink disabled:opacity-30"
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
      <p className="label text-ink-faint">Add time from somewhere else</p>
      <p className="mt-2 text-[12.5px] leading-relaxed text-ink-faint">
        This app cannot see your other apps, your other devices or your phone — and it will not
        pretend to. If you want that time counted, add it here. We always keep it separate from what
        we measured ourselves.
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
          className="w-full panel px-3 py-2 text-[14px] placeholder:text-ink-faint focus:border-focus focus:outline-none"
        />

        <div className="grid grid-cols-2 gap-2.5">
          <label className="block">
            <span className="label text-ink-faint">Minutes</span>
            <input
              type="number"
              min={1}
              max={720}
              value={minutes}
              onChange={(e) => setMinutes(Number(e.target.value))}
              className="mt-1 w-full panel px-3 py-2 text-[14px] tabular-nums focus:border-focus focus:outline-none"
            />
          </label>
          <label className="block">
            <span className="label text-ink-faint">Category</span>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as Category)}
              className="mt-1 w-full panel px-3 py-2 text-[14px] focus:border-focus focus:outline-none"
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {CATEGORY_LABEL[c]}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="label text-ink-faint">How busy?</span>
            <select
              value={intensity}
              onChange={(e) => setIntensity(e.target.value as typeof intensity)}
              className="mt-1 w-full panel px-3 py-2 text-[14px] focus:border-focus focus:outline-none"
            >
              <option value="passive">Just watching</option>
              <option value="moderate">A bit of both</option>
              <option value="heavy">Hands on</option>
            </select>
          </label>
          <label className="block">
            <span className="label text-ink-faint">Brightness</span>
            <input
              type="number"
              min={0}
              max={100}
              step={5}
              value={brightness}
              onChange={(e) => setBright(Number(e.target.value))}
              className="mt-1 w-full panel px-3 py-2 text-[14px] tabular-nums focus:border-focus focus:outline-none"
            />
          </label>
        </div>

        <button
          type="submit"
          className="w-full btn btn-primary hatch px-4 py-2.5 text-[14px]"
        >
          Add it
        </button>
      </form>
    </section>
  );
}

export function DataControls({ state, onChange }: { state: PhotonState; onChange: () => void }) {
  const [confirming, setConfirming] = useState(false);

  const download = () => {
    const blob = new Blob([exportJson()], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `photon-${todayKey()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <section className="card p-4">
      <p className="label text-ink-faint">Your data</p>

      <label className="mt-3.5 flex items-start justify-between gap-4">
        <span>
          <span className="text-[14px]">Keep measuring</span>
          <span className="mt-0.5 block text-[12px] leading-snug text-ink-faint">
            Turn this off and we stop right away. Everything you already have is kept.
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
          className="mt-1 h-5 w-9 shrink-0 cursor-pointer appearance-none rounded-pill bg-paper transition-colors checked:bg-rest"
        />
      </label>

      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        <button
          type="button"
          onClick={download}
          className="btn btn-quiet px-4 py-2 text-[13.5px]"
        >
          Download my data
        </button>
        <button
          type="button"
          onClick={() => {
            clearHistory();
            onChange();
          }}
          className="btn btn-quiet px-4 py-2 text-[13.5px]"
        >
          Clear my history
        </button>
        <button
          type="button"
          onClick={() => {
            seedSampleHistory(true);
            onChange();
          }}
          className="rounded-pill border border-ink/15 px-4 py-2 text-[13.5px] text-ink-faint transition-colors hover:border-ink hover:text-ink"
        >
          Make new example data
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
              className="flex-1 rounded-pill bg-effort px-4 py-2 text-[13.5px] font-semibold text-white"
            >
              Yes, delete it all
            </button>
            <button
              type="button"
              onClick={() => setConfirming(false)}
              className="rounded-pill border border-ink/15 px-4 py-2 text-[13.5px] text-ink-faint"
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setConfirming(true)}
            className="rounded-pill border border-effort/40 px-4 py-2 text-[13.5px] text-effort transition-colors hover:bg-effort-wash"
          >
            Delete everything
          </button>
        )}
      </div>

      <p className="mt-3.5 text-[11.5px] leading-relaxed text-ink-faint">
        Download gives you everything we have, minute by minute — not a summary. Delete removes it
        from this device, which is the only place it has ever been.
      </p>
    </section>
  );
}

export function SharingControls({
  state,
  onChange,
}: {
  state: PhotonState;
  onChange: () => void;
}) {
  const FIELDS = [
    ['fitness', 'Screen Fitness'],
    ['miles', 'Photon'],
    ['records', 'Personal records'],
    ['challenges', 'Challenges completed'],
    ['reclaimed', 'Time reclaimed'],
    ['streak', 'Current streak'],
  ] as const;

  return (
    <section className="card p-4">
      <p className="label text-ink-faint">What your share card shows</p>
      <p className="mt-2 text-[12.5px] leading-relaxed text-ink-faint">
        Only things you have achieved. A share card never shows your timeline, an app or website
        name, or anything about when you were awake.
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
                className="h-5 w-9 shrink-0 cursor-pointer appearance-none rounded-pill bg-paper transition-colors checked:bg-rest"
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
  state: PhotonState;
  onChange: () => void;
}) {
  return (
    <section className="card p-4">
      <p className="label text-ink-faint">About you</p>
      <div className="mt-3.5 space-y-2.5">
        <label className="block">
          <span className="label text-ink-faint">Display name</span>
          <input
            value={state.profile.displayName}
            onChange={(e) => {
              updateProfile({ displayName: e.target.value.slice(0, 24) });
              onChange();
            }}
            className="mt-1 w-full panel px-3 py-2 text-[14px] focus:border-focus focus:outline-none"
          />
        </label>

        <div className="grid grid-cols-2 gap-2.5">
          <label className="block">
            <span className="label text-ink-faint">You wake at</span>
            <input
              type="number"
              min={0}
              max={23}
              value={state.profile.wakeHour}
              onChange={(e) => {
                updateProfile({ wakeHour: Math.max(0, Math.min(23, Number(e.target.value))) });
                onChange();
              }}
              className="mt-1 w-full panel px-3 py-2 text-[14px] tabular-nums focus:border-focus focus:outline-none"
            />
          </label>
          <label className="block">
            <span className="label text-ink-faint">Screens off by</span>
            <input
              type="number"
              min={0}
              max={23}
              value={state.profile.curfewHour}
              onChange={(e) => {
                updateProfile({ curfewHour: Math.max(0, Math.min(23, Number(e.target.value))) });
                onChange();
              }}
              className="mt-1 w-full panel px-3 py-2 text-[14px] tabular-nums focus:border-focus focus:outline-none"
            />
          </label>
        </div>
      </div>
      <p className="mt-3 text-[11.5px] leading-relaxed text-ink-faint">
        We use these two times for the morning and evening challenges, and for the evening part of
        your Recovery score. Nothing here leaves your device.
      </p>
    </section>
  );
}

export { setBrightness };
