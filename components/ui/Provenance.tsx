import { PROVENANCE_LABEL, type Provenance } from '@/lib/mm/types';

/**
 * The provenance badge.
 *
 * This is the small piece of the interface the whole product's credibility
 * rests on. A number labelled "Measured" and a number labelled "Estimated" are
 * different kinds of claim, and a product that shows them identically is
 * asking to be believed about things it does not know.
 *
 * Measured is deliberately the quiet one. Estimated is the one that gets a
 * visible outline, because it is the one carrying a caveat.
 */

const STYLE: Record<Provenance, string> = {
  measured: 'text-ink-faint',
  derived: 'text-ink-faint',
  estimated: 'text-effort border border-effort/40 bg-effort-wash',
  unavailable: 'text-ink-faint border border-ink/15',
};

export default function ProvenanceBadge({
  provenance,
  className = '',
}: {
  provenance: Provenance;
  className?: string;
}) {
  return (
    <span
      className={`label inline-flex items-center rounded-pill px-1.5 py-0.5 ${STYLE[provenance]} ${className}`}
    >
      {PROVENANCE_LABEL[provenance]}
    </span>
  );
}
