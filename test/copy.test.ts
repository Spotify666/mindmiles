/**
 * The reading-age guard.
 *
 * Every number in this app is explained in words, and the explanations are the
 * product as much as the arithmetic is. Jargon creeps back in one commit at a
 * time — a metric gets a new input, an edge case gets a new sentence, and
 * "weighted against your baseline" is back on a card. This test reads the copy
 * the way a ten-year-old would and fails on the words they would stop at.
 *
 * It reads source files as text rather than importing them, because most of the
 * copy lives inside JSX that would need a browser to render.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { check, note, report, section } from './harness';

/**
 * Words this product does not say to a person.
 *
 * Each one has a plain replacement that says the same thing: "baseline" is
 * "what is normal for you", "derived" is "worked out", "provenance" is where a
 * number came from. They are all fine in code — the point is that the user
 * never has to learn our vocabulary to read their own day.
 */
const BANNED: Record<string, string> = {
  baseline: 'what is normal for you',
  metric: 'the name of the actual number',
  provenance: 'where the number came from',
  derived: 'worked out',
  aggregate: 'added up',
  threshold: 'the line where it counts',
  velocity: 'speed',
  cumulative: 'running total',
  weighted: 'counts for more / counts for less',
  weighting: 'how much it counts',
  normalise: 'evened out',
  normalize: 'evened out',
  calibrate: 'set up',
  fragmentation: 'jumpiness',
  intentionality: 'on plan',
  adherence: 'how much you stuck to it',
  deficit: 'how far short',
  inference: 'a good guess',
  granular: 'in detail',
  optimal: 'best',
  methodology: 'how it works',
  empirical: 'from real measurements',
  percentile: 'where you sit',
  variance: 'how much it moves about',
  deviation: 'how far off',
  magnitude: 'how big',
  temporal: 'to do with time',
  discrete: 'separate',
  utilise: 'use',
  utilize: 'use',
  leverage: 'use',
  facilitate: 'help',
  commence: 'start',
  terminate: 'stop',
  ascertain: 'find out',
  approximately: 'about',
  sufficient: 'enough',
  subsequent: 'after',
  prior: 'before',
  additionally: 'also',
  furthermore: 'and',
  consequently: 'so',
  nevertheless: 'even so',
  whereby: 'where',
  thereby: 'so',
  denote: 'mean',
  constitute: 'make up',
  comprise: 'be made of',
};

/** Claims the app used to make that are no longer true. */
const STALE: { pattern: RegExp; why: string }[] = [
  {
    // The claim itself is true and has to stay. What is no longer true is
    // presenting a typed-in number as the only thing left to do about it.
    pattern: /no (web )?(browser|page) can (read|measure)[^.]*brightness[^.]*\.\s*(so )?(this is|we use) the number you (set|typed)\.?\s*(we use it|$)/i,
    why: 'a light sensor or one camera frame now measures it, so typing is no longer the only option',
  },
  {
    pattern: /cannot see your other tabs, your other apps or your other devices/i,
    why: 'the browser add-on sees other tabs when it is installed',
  },
  { pattern: /mind ?mile/i, why: 'the app is called Photon' },
];

/** Files whose strings reach a person's eyes. */
function sources(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) sources(path, out);
    else if (/\.tsx?$/.test(name)) out.push(path);
  }
  return out;
}

/**
 * Strip what is plainly code rather than copy: comments, imports, class names,
 * keywords. What survives is filtered again in `phrases` — a banned word is a
 * perfectly good identifier, so only prose is judged.
 */
function copyOnly(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '')
    .replace(/^\s*import[\s\S]*?from\s+'[^']*';/gm, '')
    .replace(/className=(\{[^}]*\}|"[^"]*"|'[^']*')/g, '')
    .replace(/\b(?:const|let|function|interface|type|export|import|return)\b/g, ' ');
}

/** The strings a person actually reads, single- and multi-line. */
function phrases(src: string): string[] {
  const out: string[] = [];
  const body = copyOnly(src);
  for (const m of body.matchAll(/'([^'\\\n]{12,})'|"([^"\\\n]{12,})"/g)) {
    out.push((m[1] ?? m[2]) as string);
  }
  // Template literals, and JSX text, only where they hold no code at all —
  // otherwise a multi-line expression reads as one very long sentence.
  for (const m of body.matchAll(/`([^`\\;=(){}[\]<>]{12,})`/g)) out.push(m[1]);
  for (const m of body.matchAll(/>([^<>{};=()[\]]{15,})</g)) out.push(m[1]);
  return out
    .map((t) => t.replace(/\s+/g, ' ').trim())
    // A sentence has a capital and a space in it; a class list does not.
    .filter((t) => t.length >= 12 && / /.test(t) && /^[A-Z\u2018\u201c"']/.test(t));
}

const FILES = [...sources('app'), ...sources('components'), ...sources('lib/mm')];

section('no jargon in anything a person reads');
{
  let flagged = 0;
  for (const file of FILES) {
    for (const phrase of phrases(readFileSync(file, 'utf8'))) {
      for (const [word, instead] of Object.entries(BANNED)) {
        if (!new RegExp(`\\b${word}s?\\b`, 'i').test(phrase)) continue;
        flagged++;
        check(`${file}: "${word}" — say ${instead}`, false, phrase.slice(0, 100));
      }
    }
  }
  check('every word on screen is one a child would know', flagged === 0, `${flagged} to reword`);
  note(`${FILES.length} files read`);
}

section('nothing the app says about itself is out of date');
{
  // Prose only. `mindmiles.v1` is the old storage key and has to stay exactly
  // as it is, or everyone who used the app under its first name loses their
  // history on the next release.
  for (const file of FILES) {
    for (const phrase of phrases(readFileSync(file, 'utf8'))) {
      for (const { pattern, why } of STALE) {
        check(`${file}: ${why}`, !pattern.test(phrase), phrase.slice(0, 100));
      }
    }
  }
}

report();
