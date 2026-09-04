import { ACCENT_HEX, type Accent } from '@/components/ui/tokens';

/**
 * Today against your own normal.
 *
 * A single value with one reference marker — the honest form for "compared to
 * what?". The marker is a rule rather than a second bar, because your normal is
 * an annotation on today's value, not a competing quantity.
 */
export default function BaselineBar({
  label,
  value,
  baseline,
  max,
  accent = 'focus',
  format,
  lowerIsBetter = false,
}: {
  label: string;
  value: number;
  baseline?: number;
  max: number;
  accent?: Accent;
  format: (n: number) => string;
  lowerIsBetter?: boolean;
}) {
  const hex = ACCENT_HEX[accent];
  const ceiling = Math.max(max, value, baseline ?? 0) * 1.05 || 1;
  const pct = (n: number) => `${Math.min(100, (n / ceiling) * 100)}%`;

  const better = baseline === undefined ? null : lowerIsBetter ? value <= baseline : value >= baseline;

  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-[13px] text-ink-soft">{label}</span>
        <span className="text-[13px] font-bold tabular-nums">{format(value)}</span>
      </div>

      <div className="relative mt-2 h-2.5 w-full rounded-pill bg-paper">
        <div
          className="h-full rounded-pill transition-[width] duration-700"
          style={{ width: pct(value), background: hex }}
        />
        {baseline !== undefined && (
          <span
            className="absolute top-1/2 h-4 w-[2px] -translate-y-1/2 rounded-pill bg-ink-faint"
            style={{ left: pct(baseline) }}
            aria-hidden
          />
        )}
      </div>

      {baseline !== undefined && (
        <p className="label mt-1.5 text-ink-faint">
          Your normal {format(baseline)}
          {better !== null && (
            <span className={better ? 'ml-2 text-rest-text' : 'ml-2 text-effort'}>
              {better ? 'better' : 'above'}
            </span>
          )}
        </p>
      )}
    </div>
  );
}
