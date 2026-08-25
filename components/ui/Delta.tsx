import { fmtPercent, fmtSigned } from '@/lib/mm/format';
import type { BaselineDelta } from '@/lib/mm/types';
import { MIN_BASELINE_DAYS } from '@/lib/mm/baseline';

/**
 * Change against the user's own baseline.
 *
 * Green means better and amber means worse — never up-is-green, because for
 * half the metrics in this product up IS worse, and an interface that colours
 * by direction rather than by meaning teaches people to read it backwards.
 *
 * Below the minimum sample count it says so instead of showing a number. A
 * baseline built from two days is not a baseline.
 */
export default function Delta({
  delta,
  unit,
  className = '',
}: {
  delta?: BaselineDelta;
  /** Shown after the absolute change when a percentage is not meaningful. */
  unit?: string;
  className?: string;
}) {
  if (!delta) {
    return <span className={`label text-chalk-30 ${className}`}>Baseline building</span>;
  }
  if (delta.samples < MIN_BASELINE_DAYS) {
    return (
      <span className={`label text-chalk-30 ${className}`}>
        {delta.samples} of {MIN_BASELINE_DAYS} days
      </span>
    );
  }

  const level = Math.abs(delta.percent ?? delta.change) < 1;
  const tone = level ? 'text-chalk-45' : delta.better ? 'text-recovery' : 'text-strain';
  const text =
    delta.percent !== null ? fmtPercent(delta.percent) : `${fmtSigned(delta.change)}${unit ?? ''}`;

  return (
    <span className={`label whitespace-nowrap ${tone} ${className}`}>
      {text}
      <span className="ml-1.5 text-chalk-30">vs you</span>
    </span>
  );
}
