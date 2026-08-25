'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import { useMindMiles } from '@/components/MindMilesProvider';
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
    useMindMiles();
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
    lines.push({ label: 'Jumpiness', value: fmtPercent(fragChange), accent: ACCENT_HEX.scatter });
  }
  if (visualChange !== null && visualChange < -1) {
    lines.push({ label: 'Tired eyes', value: fmtPercent(visualChange), accent: ACCENT_HEX.strain });
  }
  if (state.sharing.reclaimed && reclaimedWeek.available && reclaimedWeek.minutes > 0) {
    lines.push({
      label: 'Reclaimed',
      value: fmtMin(reclaimedWeek.minutes),
      accent: ACCENT_HEX.recovery,
    });
  }
  if (state.sharing.challenges && completedChallenges > 0) {
    lines.push({
      label: 'Challenges',
      value: String(completedChallenges),
      accent: ACCENT_HEX.record,
    });
  }

  const summaryText = [
    'My week in Mind Miles',
    ...lines.map((l) => `${l.label}: ${l.value}`),
    state.sharing.fitness ? `Screen Fitness: ${fitness}` : null,
    state.sharing.records && newRecords.length
      ? `New personal best: ${newRecords[0].label} — ${newRecords[0].display}`
      : null,
    '',
    'Measured on my own device with Mind Miles.',
  ]
    .filter(Boolean)
    .join('\n');

  async function share() {
    try {
      if (navigator.share) {
        await navigator.share({ title: 'My week in Mind Miles', text: summaryText });
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
      a.download = `mind-miles-week.png`;
      a.click();
      URL.revokeObjectURL(url);
      setStatus('Saved to your device.');
    }, 'image/png');
  }

  const hasBaseline = baseline.ready(today.date);

  return (
    <div className="mx-auto flex max-w-app flex-col gap-3.5">
      <div>
        <h1 className="text-[22px] font-[620] tracking-tightest">Share card</h1>
        <p className="mt-1.5 text-[13px] leading-relaxed text-chalk-45">
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
        className="relative rounded-card border border-hair bg-surface p-6"
        style={{ minHeight: 'min(74vh, 560px)' }}
      >
        <div className="flex min-h-[inherit] flex-col">
          <Wordmark size="sm" variant="gradient" />

          <p className="mt-7 text-[26px] font-[620] leading-tight tracking-tightest">
            My week in
            <br />
            Mind Miles
          </p>

          {lines.length === 0 ? (
            <p className="mt-6 text-[14px] leading-relaxed text-chalk-45">
              {hasBaseline
                ? 'Nothing to show for this week yet. The card fills in as the week goes on.'
                : 'We are still learning what a normal week looks like for you. Comparisons show up in a few days.'}
            </p>
          ) : (
            <ul className="mt-6 space-y-3.5">
              {lines.map((l) => (
                <li key={l.label} className="flex items-baseline justify-between gap-4">
                  <span className="text-[15px] text-chalk-70">{l.label}</span>
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
                <p className="label" style={{ color: ACCENT_HEX.record }}>
                  Your best yet
                </p>
                <p className="mt-1 text-[15px] font-[560]">
                  {newRecords[0].label} · {newRecords[0].display}
                </p>
              </div>
            )}

            {state.sharing.fitness && (
              <div className="flex items-baseline justify-between gap-4 border-t border-hair pt-4">
                <span className="label text-chalk-30">Screen Fitness</span>
                <span className="readout text-[36px]" style={{ color: ACCENT_HEX.record }}>
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
          className="rounded-pill bg-focus px-4 py-2.5 text-[14px] font-[560] text-void transition-opacity hover:opacity-90"
        >
          Share
        </button>
        <button
          type="button"
          onClick={downloadPng}
          className="rounded-pill border border-hair px-4 py-2.5 text-[14px] text-chalk-70 transition-colors hover:border-hair-strong hover:text-chalk"
        >
          Save as picture
        </button>
      </div>

      {status && <p className="text-[12.5px] text-chalk-45">{status}</p>}

      <p className="text-[11.5px] leading-relaxed text-chalk-30">
        The card is made here on your device. Nothing is uploaded to create it.{' '}
        <Link href="/profile" className="text-chalk-45 underline underline-offset-2 hover:text-chalk">
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
  const sans = (size: number, weight = 400) =>
    `${weight} ${size}px "Inter Tight", ui-sans-serif, system-ui, sans-serif`;

  ctx.fillStyle = '#08090C';
  ctx.fillRect(0, 0, CARD_W, CARD_H);

  // The mark: the same five-point route, scaled from its 40-unit field.
  const s = 1.6;
  const ox = PAD;
  const oy = PAD;
  const route: [number, number][] = [
    [4, 30.5],
    [11.5, 13],
    [18.5, 21.5],
    [26.5, 6.5],
    [33, 19],
  ];
  const grad = ctx.createLinearGradient(ox + 4 * s, oy + 30 * s, ox + 33 * s, oy + 19 * s);
  grad.addColorStop(0, '#497CFD');
  grad.addColorStop(0.62, '#7C9BFF');
  grad.addColorStop(1, '#F5C451');
  ctx.strokeStyle = grad;
  ctx.lineWidth = 4 * s;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  route.forEach(([x, y], i) => {
    const px = ox + x * s;
    const py = oy + y * s;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  });
  ctx.stroke();
  ctx.fillStyle = '#08090C';
  ctx.beginPath();
  ctx.arc(ox + 33 * s, oy + 19 * s, 5.6 * s, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#F5C451';
  ctx.beginPath();
  ctx.arc(ox + 33 * s, oy + 19 * s, 3.4 * s, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#F4F6FA';
  ctx.font = sans(30, 620);
  ctx.textBaseline = 'middle';
  ctx.fillText('MIND MILES', ox + 40 * s + 16, oy + 19 * s);

  let y = PAD + 190;
  ctx.textBaseline = 'alphabetic';
  ctx.font = sans(74, 620);
  ctx.fillText('My week in', PAD, y);
  ctx.fillText('Mind Miles', PAD, y + 82);
  y += 200;

  for (const line of data.lines) {
    ctx.fillStyle = 'rgba(244,246,250,0.70)';
    ctx.font = sans(38);
    ctx.fillText(line.label, PAD, y);

    ctx.fillStyle = line.accent;
    ctx.font = sans(58, 620);
    ctx.textAlign = 'right';
    ctx.fillText(line.value, CARD_W - PAD, y + 6);
    ctx.textAlign = 'left';
    y += 92;
  }

  if (data.record) {
    y += 20;
    ctx.fillStyle = 'rgba(245,196,81,0.12)';
    roundRect(ctx, PAD, y - 46, CARD_W - PAD * 2, 128, 22);
    ctx.fill();
    ctx.fillStyle = '#F5C451';
    ctx.font = sans(26, 500);
    ctx.fillText('NEW PERSONAL BEST', PAD + 32, y);
    ctx.fillStyle = '#F4F6FA';
    ctx.font = sans(38, 560);
    ctx.fillText(`${data.record.label} · ${data.record.value}`, PAD + 32, y + 50);
    y += 150;
  }

  if (data.fitness !== null) {
    const baseY = CARD_H - PAD - 40;
    ctx.strokeStyle = 'rgba(244,246,250,0.09)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(PAD, baseY - 86);
    ctx.lineTo(CARD_W - PAD, baseY - 86);
    ctx.stroke();

    ctx.fillStyle = 'rgba(244,246,250,0.45)';
    ctx.font = sans(28, 500);
    ctx.fillText('SCREEN FITNESS', PAD, baseY - 10);

    ctx.fillStyle = '#F5C451';
    ctx.font = sans(84, 620);
    ctx.textAlign = 'right';
    ctx.fillText(String(data.fitness), CARD_W - PAD, baseY + 6);
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
