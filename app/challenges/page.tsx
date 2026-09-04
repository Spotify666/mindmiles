'use client';

import { usePhoton } from '@/components/PhotonProvider';
import { joinChallenge, leaveChallenge } from '@/lib/mm/store';
import { plural } from '@/lib/mm/format';
import type { ChallengeProgress } from '@/lib/mm/types';
import { ACCENT_HEX } from '@/components/ui/tokens';

/**
 * CHALLENGES.
 *
 * Cards show real progress before you join, not after. A challenge that only
 * starts counting once you have committed to it is asking for commitment
 * without evidence; showing where you already stand turns the decision into an
 * informed one.
 *
 * There is no failure state anywhere on this screen. A window can close, and
 * that is all — no streak breaks, nothing is lost, and the card says how far
 * you got rather than that you did not finish.
 */
export default function ChallengesPage() {
  const { challenges, refresh } = usePhoton();

  const active = challenges.filter((c) => c.status === 'active');
  const complete = challenges.filter((c) => c.status === 'complete');
  const rest = challenges.filter((c) => c.status === 'available' || c.status === 'expired');

  return (
    <div className="mx-auto flex max-w-app flex-col gap-3.5 md:max-w-none">
      <div>
        <h1 className="display text-[24px]">Challenges</h1>
        <p className="mt-1.5 text-[13px] leading-relaxed text-ink-faint">
          Every challenge is measured against how you normally are — so a long working day is no
          barrier to any of them. None of them are about using your phone less.
        </p>
      </div>

      {active.length > 0 && (
        <Group title="In progress">
          {active.map((c) => (
            <Card key={c.def.id} c={c} onChange={refresh} />
          ))}
        </Group>
      )}

      {complete.length > 0 && (
        <Group title="Completed">
          {complete.map((c) => (
            <Card key={c.def.id} c={c} onChange={refresh} />
          ))}
        </Group>
      )}

      <Group title={active.length || complete.length ? 'Available' : 'Pick one'}>
        {rest.map((c) => (
          <Card key={c.def.id} c={c} onChange={refresh} />
        ))}
      </Group>
    </div>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <p className="label mb-2.5 text-ink-faint">{title}</p>
      <div className="grid gap-2.5 md:grid-cols-2 lg:grid-cols-3">{children}</div>
    </section>
  );
}

function Card({ c, onChange }: { c: ChallengeProgress; onChange: () => void }) {
  const hex = ACCENT_HEX[c.def.accent];
  const pct = Math.round(c.progress * 100);
  const done = c.status === 'complete';
  const started = c.status === 'active' || done;

  return (
    <article
      className="card flex flex-col p-4"
      style={done ? { borderColor: 'rgba(245,196,81,0.30)' } : undefined}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-[15.5px] font-bold tracking-tightest">{c.def.name}</h2>
          <p className="mt-1 text-[13px] leading-snug text-ink-soft">{c.def.premise}</p>
        </div>
        <span
          className="label shrink-0 rounded-pill px-2 py-0.5 text-ink-faint"
          style={
            done
              ? { color: ACCENT_HEX.gold, background: 'rgba(245,196,81,0.12)' }
              : { color: 'rgba(244,246,250,0.45)', border: '1px solid rgba(244,246,250,0.09)' }
          }
        >
          {done ? 'Done' : plural(c.def.days, 'day')}
        </span>
      </div>

      {/*
        Progress is only a percentage once the challenge has been started. Before
        that, the same measurement is shown as recent form — a bar reading 100%
        above an untouched Start button says the thing is already won, which is
        both wrong and the reason nobody would press it.
      */}
      <div className="mt-4">
        {started ? (
          <>
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-[12.5px] text-ink-faint">{c.detail}</span>
              <span className="text-[12.5px] font-bold tabular-nums">{pct}%</span>
            </div>
            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-pill bg-paper">
              <div
                className="h-full rounded-pill transition-[width] duration-700"
                style={{ width: `${pct}%`, background: done ? ACCENT_HEX.gold : hex }}
              />
            </div>
          </>
        ) : (
          <div className="panel px-3 py-2.5">
            <p className="label text-ink-faint">Where you are right now</p>
            <p className="mt-1 text-[12.5px] text-ink-soft">{c.detail}</p>
          </div>
        )}
      </div>

      <p className="mt-3.5 text-[11.5px] leading-relaxed text-ink-faint">{c.def.criterion}</p>

      <div className="mt-4 flex items-center gap-2 pt-0.5">
        {c.status === 'available' || c.status === 'expired' ? (
          <button
            type="button"
            onClick={() => {
              joinChallenge(c.def.id);
              onChange();
            }}
            className="rounded-pill px-3.5 py-1.5 text-[13px] font-semibold text-white transition-opacity hover:opacity-90"
            style={{ background: hex }}
          >
            {c.status === 'expired' ? 'Try again' : 'Start'}
          </button>
        ) : !done ? (
          <>
            <span className="label text-ink-faint">
              {c.daysLeft === 0 ? 'Last day' : `${plural(c.daysLeft ?? 0, 'day')} left`}
            </span>
            <button
              type="button"
              onClick={() => {
                leaveChallenge(c.def.id);
                onChange();
              }}
              className="label ml-auto text-ink-faint transition-colors hover:text-ink-soft"
            >
              Leave
            </button>
          </>
        ) : (
          <span className="label text-ink-faint" style={{ color: ACCENT_HEX.gold }}>
            Done{c.completedOn ? ` · ${c.completedOn}` : ''}
          </span>
        )}
      </div>
    </article>
  );
}
