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
  measured: 'text-chalk-45',
  derived: 'text-chalk-45',
  estimated: 'text-strain/80 border border-strain/25 bg-strain-dim',
  unavailable: 'text-chalk-30 border border-hair',
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
