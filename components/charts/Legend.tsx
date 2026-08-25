import { ACCENT_HEX, type Accent } from '@/components/ui/tokens';

/**
 * A legend, present whenever a chart carries more than one series.
 *
 * It exists because the palette's worst colour-deficiency pair sits in the band
 * where colour alone is not allowed to carry identity. Every swatch here is
 * paired with a word, and the charts themselves add direct value labels.
 */
export default function Legend({
  items,
  className = '',
}: {
  items: { label: string; accent: Accent; value?: string; note?: string }[];
  className?: string;
}) {
  return (
    <ul className={`flex flex-wrap items-start gap-x-5 gap-y-2 ${className}`}>
      {items.map((i) => (
        <li key={i.label} className="flex items-start gap-2">
          <span
            className="mt-[5px] h-2.5 w-2.5 shrink-0 rounded-[3px]"
            style={{ background: ACCENT_HEX[i.accent] }}
            aria-hidden
          />
          <div className="min-w-0">
            <span className="text-[12.5px] text-chalk-70">{i.label}</span>
            {i.value && <span className="ml-1.5 text-[12.5px] font-[620] tabular-nums">{i.value}</span>}
            {i.note && <span className="block text-[11px] leading-snug text-chalk-30">{i.note}</span>}
          </div>
        </li>
      ))}
    </ul>
  );
}
