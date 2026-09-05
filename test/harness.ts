/**
 * A test runner in forty lines, because the alternative is a test framework.
 *
 * This project has no runtime dependencies beyond React and Next, and the layer
 * under test is pure functions over plain objects. Pulling in a runner to call
 * those functions would be the largest dependency in the repository and would
 * earn nothing that `assert` does not already do.
 */

let checks = 0;
let failures = 0;
let current = '';

export function section(name: string): void {
  current = name;
  process.stdout.write(`\n── ${name} ${'─'.repeat(Math.max(2, 58 - name.length))}\n`);
}

export function check(name: string, passed: boolean, detail?: unknown): void {
  checks++;
  if (passed) return;
  failures++;
  const shown = detail === undefined ? '' : `  →  ${format(detail)}`;
  process.stdout.write(`  FAIL  ${current ? current + ' / ' : ''}${name}${shown}\n`);
}

export function note(text: string): void {
  process.stdout.write(`    ${text}\n`);
}

function format(v: unknown): string {
  if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') return String(v);
  try {
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
}

/**
 * Walk a structure looking for anything that would reach the screen as "NaN",
 * "Infinity" or "undefined".
 *
 * Every number in this product ends up rendered somewhere, so a value being
 * finite is not an implementation detail — it is the difference between a card
 * that reads "2h 14m" and one that reads "NaNh NaNm".
 */
export function junk(value: unknown, path = 'value', out: string[] = []): string[] {
  if (value === null || value === undefined) return out;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) out.push(`${path} = ${value}`);
    return out;
  }
  if (typeof value === 'string') {
    if (/NaN|Infinity|undefined/.test(value)) out.push(`${path} = "${value}"`);
    return out;
  }
  if (Array.isArray(value)) {
    value.forEach((v, i) => junk(v, `${path}[${i}]`, out));
    return out;
  }
  if (typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) junk(v, `${path}.${k}`, out);
    return out;
  }
  return out;
}

export function clean(name: string, value: unknown): void {
  const bad = junk(value, name);
  check(`${name} renders cleanly`, bad.length === 0, bad.slice(0, 4).join(' | '));
}

/** Deterministic pseudo-random, so a failing fuzz case is reproducible. */
export function rng(seed: number): () => number {
  let s = seed;
  return () => (s = (s * 1103515245 + 12345) % 2147483648) / 2147483648;
}

export function report(): void {
  process.stdout.write(`\n${'═'.repeat(62)}\n`);
  process.stdout.write(
    failures === 0 ? `ALL ${checks} CHECKS PASSED\n` : `${failures} FAILED of ${checks} checks\n`,
  );
  if (failures > 0) process.exitCode = 1;
}
