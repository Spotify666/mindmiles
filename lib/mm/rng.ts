/**
 * Deterministic, seedable RNG.
 *
 * Sample history is generated from the date string, so the same day always
 * produces the same demo data. That matters more than it sounds: without it,
 * every re-render would reshuffle the charts and the app would look like it was
 * making its numbers up — which, for sample data, it partly is, and which is
 * exactly why it is labelled as sample everywhere it appears.
 */

export type Rng = () => number;

/** Hash a string into a 32-bit integer (xmur3). */
function xmur3(str: string): () => number {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return h >>> 0;
  };
}

/** Small, fast PRNG (sfc32). */
function sfc32(a: number, b: number, c: number, d: number): Rng {
  return () => {
    a >>>= 0;
    b >>>= 0;
    c >>>= 0;
    d >>>= 0;
    let t = (a + b) | 0;
    a = b ^ (b >>> 9);
    b = (c + (c << 3)) | 0;
    c = (c << 21) | (c >>> 11);
    d = (d + 1) | 0;
    t = (t + d) | 0;
    c = (c + t) | 0;
    return (t >>> 0) / 4294967296;
  };
}

export function makeRng(seed: string): Rng {
  const s = xmur3(seed);
  return sfc32(s(), s(), s(), s());
}
