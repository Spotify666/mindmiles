'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import { usePhoton } from '@/components/PhotonProvider';
import { Wordmark } from '@/components/brand/Logo';
import { fmtMiles, fmtMin, fmtPercent } from '@/lib/mm/format';
import { totalMileage } from '@/lib/mm/metrics';
import { ACCENT_HEX } from '@/components/ui/tokens';

/**
 * THE SHARE CARD.
 *
 * The thing nobody wants to post is "I spent seven hours on my phone." The
 * thing people do post is a personal best. So this card carries achievement and
 * nothing else — and the restraint is enforced rather than encouraged:
 *
 *   No timeline. No hours-of-day. No app names, site names or session detail.
 *   No total screen time, ever, in any form.
 *   Every line is individually switchable in Profile, and off means absent.
 *
 * What is left is deltas against the user's own baseline and things they
 * achieved. Someone reading the card learns that the sender had a good week; it
 * tells them nothing about when the sender was awake.
 */

const CARD_W = 1080;
const CARD_H = 1350;

export default function SharePage() {
  const { summaries, reports, records, challenges, reclaimedWeek, fitness, state, baseline, today } =
    usePhoton();
  const cardRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<string | null>(null);

  const week = summaries.slice(-7);
  const prior = summaries.slice(-14, -7);
  const miles = totalMileage(week);
  const priorMiles = totalMileage(prior);

  const focusChange =
    priorMiles.focus > 0.5 ? ((miles.focus - priorMiles.focus) / priorMiles.focus) * 100 : null;

  const weekReports = reports.slice(-7).filter((r) => r.summary.activeMin >= 15);
  const priorReports = reports.slice(-14, -7).filter((r) => r.summary.activeMin >= 15);
  const meanOf = (rs: typeof weekReports, pick: (r: (typeof weekReports)[number]) => number) =>
    rs.length ? rs.reduce((s, r) => s + pick(r), 0) / rs.length : null;

  const fragNow = meanOf(weekReports, (r) => r.fragmentation.value);
  const fragBefore = meanOf(priorReports, (r) => r.fragmentation.value);
  const fragChange =
    fragNow !== null && fragBefore !== null && fragBefore > 1
      ? ((fragNow - fragBefore) / fragBefore) * 100
      : null;

  const visualNow = meanOf(weekReports, (r) => r.visual.value);
  const visualBefore = meanOf(priorReports, (r) => r.visual.value);
  const visualChange =
    visualNow !== null && visualBefore !== null && visualBefore > 1
      ? ((visualNow - visualBefore) / visualBefore) * 100
      : null;

  const newRecords = records.filter((r) => week.some((w) => w.date === r.date));
  const completedChallenges = challenges.filter((c) => c.status === 'complete').length;

  /*
   * Only improvements appear on the card, and this is the one piece of
   * selection in the product that needs defending.
   *
   * The card is explicitly an achievement artefact — the page says so above it,
   * and every number on it is a comparison against the sender's own baseline. A
   * mixed card would also be actively misleading rather than more honest,
   * because the sign convention flips between metrics: "Focus −9%" is a bad week
   * and "Fragmentation −9%" is a good one, and no reader is going to track which
   * is which. Declines are not hidden from the user — they are on Today and on
   * Trends, with the baseline attached. They are simply not what a share card is.
   */
  const lines: { label: string; value: string; accent: string }[] = [];
  if (state.sharing.miles) {
    lines.push({ label: 'Focus Miles', value: fmtMiles(miles.focus), accent: ACCENT_HEX.focus });
  }
  if (state.sharing.miles && focusChange !== null && focusChange > 1) {
    lines.push({ label: 'Focus', value: fmtPercent(focusChange), accent: ACCENT_HEX.focus });
  }
  if (fragChange !== null && fragChange < -1) {
    lines.push({ label: 'Jumpiness', value: fmtPercent(fragChange), accent: ACCENT_HEX.jumpy });
  }
  if (visualChange !== null && visualChange < -1) {
    lines.push({ label: 'Tired eyes', value: fmtPercent(visualChange), accent: ACCENT_HEX.effort });
  }
  if (state.sharing.reclaimed && reclaimedWeek.available && reclaimedWeek.minutes > 0) {
    lines.push({
      label: 'Reclaimed',
      value: fmtMin(reclaimedWeek.minutes),
      accent: ACCENT_HEX.rest,
    });
  }
  if (state.sharing.challenges && completedChallenges > 0) {
    lines.push({
      label: 'Challenges',
      value: String(completedChallenges),
      accent: ACCENT_HEX.gold,
    });
  }

  const summaryText = [
    'My week in Photon',
    ...lines.map((l) => `${l.label}: ${l.value}`),
    state.sharing.fitness ? `Screen Fitness: ${fitness}` : null,
    state.sharing.records && newRecords.length
      ? `New personal best: ${newRecords[0].label} — ${newRecords[0].display}`
      : null,
    '',
    'Measured on my own device with Photon.',
  ]
    .filter(Boolean)
    .join('\n');

  async function share() {
    try {
      if (navigator.share) {
        await navigator.share({ title: 'My week in Photon', text: summaryText });
        return;
      }
      await navigator.clipboard.writeText(summaryText);
      setStatus('Copied — paste it anywhere.');
    } catch {
      setStatus('Sharing was cancelled.');
    }
  }

  function downloadPng() {
    const canvas = document.createElement('canvas');
    canvas.width = CARD_W;
    canvas.height = CARD_H;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    drawCard(ctx, {
      name: state.profile.displayName,
      fitness: state.sharing.fitness ? fitness : null,
      lines,
      record:
        state.sharing.records && newRecords.length
          ? { label: newRecords[0].label, value: newRecords[0].display }
          : null,
    });
    canvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `photon-week.png`;
      a.click();
      URL.revokeObjectURL(url);
      setStatus('Saved to your device.');
    }, 'image/png');
  }

  const hasBaseline = baseline.ready(today.date);

  return (
    <div className="mx-auto flex max-w-app flex-col gap-3.5">
      <div>
        <h1 className="display text-[24px]">Share card</h1>
        <p className="mt-1.5 text-[13px] leading-relaxed text-ink-faint">
          Only the good bits. No timeline, no app names, no “hours on your phone” — and you can
          switch any line off in your profile.
        </p>
      </div>

      {/* The visible card. 4:5, which is what survives a feed crop. */}
      {/* Minimum aspect rather than fixed: a card with a personal best on it is
          taller than 4:5, and clipping the Digital Fitness line off the bottom
          to preserve a ratio is the wrong trade. */}
      <div
        ref={cardRef}
        className="relative rounded-card border border-ink/15 bg-card p-6"
        style={{ minHeight: 'min(74vh, 560px)' }}
      >
        <div className="flex min-h-[inherit] flex-col">
          <Wordmark size="sm" />

          <p className="mt-7 text-[26px] font-bold leading-tight tracking-tightest">
            My week in
            <br />
            Photon
          </p>

          {lines.length === 0 ? (
            <p className="mt-6 text-[14px] leading-relaxed text-ink-faint">
              {hasBaseline
                ? 'Nothing to show for this week yet. The card fills in as the week goes on.'
                : 'We are still learning what a normal week looks like for you. Comparisons show up in a few days.'}
            </p>
          ) : (
            <ul className="mt-6 space-y-3.5">
              {lines.map((l) => (
                <li key={l.label} className="flex items-baseline justify-between gap-4">
                  <span className="text-[15px] text-ink-soft">{l.label}</span>
                  <span className="readout text-[26px]" style={{ color: l.accent }}>
                    {l.value}
                  </span>
                </li>
              ))}
            </ul>
          )}

          <div className="mt-auto pt-6">
            {state.sharing.records && newRecords.length > 0 && (
              <div
                className="mb-3.5 rounded-[14px] px-3.5 py-3"
                style={{ background: 'rgba(245,196,81,0.12)' }}
              >
                <p className="label text-ink-faint" style={{ color: ACCENT_HEX.gold }}>
                  Your best yet
                </p>
                <p className="mt-1 text-[15px] font-semibold">
                  {newRecords[0].label} · {newRecords[0].display}
                </p>
              </div>
            )}

            {state.sharing.fitness && (
              <div className="flex items-baseline justify-between gap-4 border-t border-ink/15 pt-4">
                <span className="label text-ink-faint">Screen Fitness</span>
                <span className="readout text-[36px]" style={{ color: ACCENT_HEX.gold }}>
                  {fitness}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        <button
          type="button"
          onClick={share}
          className="btn btn-primary hatch px-4 py-2.5 text-[14px]"
        >
          Share
        </button>
        <button
          type="button"
          onClick={downloadPng}
          className="btn btn-quiet px-4 py-2.5 text-[14px]"
        >
          Save as picture
        </button>
      </div>

      {status && <p className="text-[12.5px] text-ink-faint">{status}</p>}

      <p className="text-[11.5px] leading-relaxed text-ink-faint">
        The card is made here on your device. Nothing is uploaded to create it.{' '}
        <Link href="/profile" className="text-ink-faint underline underline-offset-2 hover:text-ink">
          Change what it shows
        </Link>
        .
      </p>
    </div>
  );
}

/**
 * Draw the card straight onto a canvas.
 *
 * Deliberately not a screenshot of the DOM: rasterising HTML through an SVG
 * foreignObject drops webfonts in most browsers, and a share card with fallback
 * type is worse than no share card. This is a few more lines and it renders
 * identically everywhere.
 */
function drawCard(
  ctx: CanvasRenderingContext2D,
  data: {
    name: string;
    fitness: number | null;
    lines: { label: string; value: string; accent: string }[];
    record: { label: string; value: string } | null;
  },
) {
  const PAD = 88;
  const INK = '#14181F';
  const sans = (size: number, weight = 400) =>
    `${weight} ${size}px Figtree, ui-sans-serif, system-ui, sans-serif`;

  // Paper, with the same faint dot grid the app uses.
  ctx.fillStyle = '#EFF4F9';
  ctx.fillRect(0, 0, CARD_W, CARD_H);
  ctx.fillStyle = 'rgba(20,24,31,0.055)';
  for (let y = 22; y < CARD_H; y += 44) {
    for (let x = 22; x < CARD_W; x += 44) {
      ctx.beginPath();
      ctx.arc(x, y, 2, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // A drawn card, outlined rather than shadowed — the same rule as the app.
  const cx = 48;
  const cy = 48;
  const cw = CARD_W - 96;
  const ch = CARD_H - 96;
  ctx.fillStyle = '#FFFFFF';
  roundRect(ctx, cx, cy, cw, ch, 28);
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 5;
  roundRect(ctx, cx, cy, cw, ch, 28);
  ctx.stroke();

  // The wave, at the same proportions as everywhere else.
  const s = 3.1;
  const ox = PAD;
  const oy = PAD + 10;
  ctx.strokeStyle = '#2B90E0';
  ctx.lineWidth = 3.4 * s;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(ox + 3 * s, oy + 12 * s);
  ctx.bezierCurveTo(ox + 6 * s, oy + 4 * s, ox + 10 * s, oy + 4 * s, ox + 13 * s, oy + 12 * s);
  ctx.bezierCurveTo(ox + 16 * s, oy + 20 * s, ox + 20 * s, oy + 20 * s, ox + 23 * s, oy + 12 * s);
  ctx.bezierCurveTo(ox + 26 * s, oy + 4 * s, ox + 30 * s, oy + 4 * s, ox + 33 * s, oy + 12 * s);
  ctx.stroke();
  ctx.fillStyle = '#2B90E0';
  ctx.beginPath();
  ctx.arc(ox + 38.5 * s, oy + 12 * s, 3.1 * s, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = INK;
  ctx.font = sans(44, 800);
  ctx.textBaseline = 'middle';
  ctx.fillText('photon', ox + 44 * s + 22, oy + 12 * s);

  let y = PAD + 210;
  ctx.textBaseline = 'alphabetic';
  ctx.font = sans(70, 800);
  ctx.fillText('My week', PAD, y);
  ctx.fillText('on screens', PAD, y + 78);

  // The hand-drawn underline, under the second line.
  const uw = ctx.measureText('on screens').width;
  ctx.strokeStyle = '#2B90E0';
  ctx.lineWidth = 7;
  ctx.beginPath();
  ctx.moveTo(PAD, y + 96);
  ctx.bezierCurveTo(PAD + uw * 0.3, y + 90, PAD + uw * 0.55, y + 102, PAD + uw, y + 93);
  ctx.stroke();

  y += 190;

  for (const line of data.lines) {
    ctx.fillStyle = '#4B5563';
    ctx.font = sans(36);
    ctx.fillText(line.label, PAD, y);

    ctx.fillStyle = line.accent;
    ctx.font = sans(56, 800);
    ctx.textAlign = 'right';
    ctx.fillText(line.value, CARD_W - PAD, y + 6);
    ctx.textAlign = 'left';
    y += 88;
  }

  if (data.record) {
    y += 18;
    ctx.fillStyle = '#FAF1DC';
    roundRect(ctx, PAD, y - 46, CARD_W - PAD * 2, 126, 18);
    ctx.fill();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 3;
    roundRect(ctx, PAD, y - 46, CARD_W - PAD * 2, 126, 18);
    ctx.stroke();

    ctx.fillStyle = '#8F630B';
    ctx.font = sans(26, 700);
    ctx.fillText('Best yet', PAD + 30, y);
    ctx.fillStyle = INK;
    ctx.font = sans(36, 600);
    ctx.fillText(`${data.record.label} · ${data.record.value}`, PAD + 30, y + 50);
    y += 148;
  }

  if (data.fitness !== null) {
    const baseY = CARD_H - PAD - 46;
    ctx.strokeStyle = 'rgba(20,24,31,0.16)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(PAD, baseY - 84);
    ctx.lineTo(CARD_W - PAD, baseY - 84);
    ctx.stroke();

    ctx.fillStyle = '#4B5563';
    ctx.font = sans(30, 600);
    ctx.fillText('Screen Fitness', PAD, baseY - 8);

    ctx.fillStyle = '#8F630B';
    ctx.font = sans(82, 800);
    ctx.textAlign = 'right';
    ctx.fillText(String(data.fitness), CARD_W - PAD, baseY + 8);
    ctx.textAlign = 'left';
  }
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
