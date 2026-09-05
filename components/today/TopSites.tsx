'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { extensionInstalled, onExtensionData, sitesFor, type SiteTotal } from '@/lib/mm/extension';
import { fmtMin, plural } from '@/lib/mm/format';
import { ACCENT_HEX } from '@/components/ui/tokens';

/**
 * WHERE YOUR TIME WENT.
 *
 * The one question every screen-time product answers and this one could not:
 * which apps and sites actually took the day.
 *
 * It is answerable now only because the extension can see other tabs — a web
 * page cannot, and never will. So this section is honest in both directions: it
 * shows a real ranked breakdown when the extension is running, and when it is
 * not it says plainly that we cannot see it and points at the thing that can.
 * It never estimates a breakdown, because a guess at which apps you used is not
 * a softer version of knowing — it is a different claim entirely.
 *
 * Only domains appear here. The extension discards the path, the query string
 * and the page title the moment it sees a URL, so "which site" is the most
 * specific this can ever get, by design rather than by omission.
 */

/** Enough to see the shape of a day without turning into a log. */
const SHOWN = 6;

export default function TopSites({ date }: { date: string }) {
  const [sites, setSites] = useState<SiteTotal[]>([]);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    const sync = () => {
      setInstalled(extensionInstalled());
      setSites(sitesFor(date));
    };
    sync();
    return onExtensionData(sync);
  }, [date]);

  if (!installed && sites.length === 0) {
    return (
      <section className="card p-4">
        <p className="label text-ink-faint">Where your time went</p>
        <p className="mt-2.5 text-[14px] leading-relaxed text-ink-soft">
          A web page can only see itself, so Photon cannot tell which apps or sites took your day.
          Nothing in a browser can.
        </p>
        <p className="mt-2.5 text-[13px] leading-relaxed text-ink-faint">
          The Photon extension can — it sees every tab and records the site name and how long, and
          nothing else. Install it and this fills in.
        </p>
        <Link href="/install" className="btn btn-quiet mt-3.5 px-4 py-2 text-[13.5px]">
          How to add it
        </Link>
      </section>
    );
  }

  const total = sites.reduce((s, x) => s + x.minutes, 0);
  const top = sites.slice(0, SHOWN);
  const rest = sites.slice(SHOWN);
  const restMinutes = rest.reduce((s, x) => s + x.minutes, 0);

  return (
    <section className="card relative p-4">
      <span className="tape tape-right right-9" aria-hidden />

      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="label text-ink-faint">Where your time went</p>
        <span className="text-[12.5px] text-ink-faint">{fmtMin(total)} across {plural(sites.length, 'site')}</span>
      </div>

      {top.length === 0 ? (
        <p className="mt-2.5 text-[14px] text-ink-soft">Nothing recorded yet today.</p>
      ) : (
        <ol className="mt-3.5 space-y-3">
          {top.map((s, i) => (
            <li key={s.host}>
              <div className="flex items-baseline gap-3">
                <span className="w-4 shrink-0 text-[13px] font-bold tabular-nums text-ink-faint">
                  {i + 1}
                </span>
                <span className="min-w-0 flex-1 truncate text-[14.5px] font-semibold">{s.host}</span>
                <span className="shrink-0 text-[14px] font-bold tabular-nums">
                  {fmtMin(s.minutes)}
                </span>
              </div>
              <div className="mt-1.5 ml-7 h-2 overflow-hidden rounded-pill border border-ink/15 bg-paper">
                <div
                  className="h-full rounded-pill"
                  style={{
                    width: `${(s.minutes / Math.max(top[0].minutes, 1)) * 100}%`,
                    background: ACCENT_HEX.focus,
                  }}
                />
              </div>
            </li>
          ))}
        </ol>
      )}

      {rest.length > 0 && (
        <p className="mt-3.5 text-[12.5px] text-ink-faint">
          Plus {rest.length} more, {fmtMin(restMinutes)} between them.
        </p>
      )}

      <p className="mt-4 text-[11.5px] leading-relaxed text-ink-faint">
        Site names only. The extension throws away the page address and title before anything is
        written down, so this is as specific as it can ever get.
      </p>
    </section>
  );
}
