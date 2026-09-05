'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { usePhoton } from '@/components/PhotonProvider';

/**
 * Primary navigation.
 *
 * Four destinations, no more. On mobile it is a bottom bar, inside thumb reach
 * and above the home indicator; on desktop the same four sit in the header.
 * Four is the ceiling because the product's claim is that you can understand
 * your state in five seconds, and a five-tab app has already failed that.
 *
 * The week has the slot rather than Trends, and that is the product argument
 * made in navigation: the review is what this app is for, and the charts are
 * where you go once it has told you something worth digging into. Trends is
 * still there, one tap from the bottom of the week.
 */

const TABS = [
  { href: '/', label: 'Today', icon: TodayIcon },
  { href: '/week', label: 'Week', icon: WeekIcon },
  { href: '/challenges', label: 'Challenges', icon: ChallengeIcon },
  { href: '/profile', label: 'Profile', icon: ProfileIcon },
] as const;

function useActive(href: string): boolean {
  const path = usePathname();
  return href === '/' ? path === '/' : path.startsWith(href);
}

export function TabBar() {
  // Nothing to navigate to until the welcome has been read — four tabs under a
  // "Start measuring" button is an invitation to skip the only screen that
  // explains what this is.
  const { state } = usePhoton();
  if (!state.onboarded) return null;

  return (
    <nav
      aria-label="Primary"
      className="safe-b fixed inset-x-0 bottom-0 z-40 border-t border-ink/15 bg-paper/92 backdrop-blur-lg md:hidden"
    >
      <ul className="mx-auto flex max-w-app items-stretch">
        {TABS.map((t) => (
          <li key={t.href} className="flex-1">
            <TabLink {...t} />
          </li>
        ))}
      </ul>
    </nav>
  );
}

function TabLink({ href, label, icon: Icon }: (typeof TABS)[number]) {
  const active = useActive(href);
  return (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      className={`flex flex-col items-center gap-1 px-1 pb-2 pt-2.5 transition-colors ${
        active ? 'text-ink' : 'text-ink-faint hover:text-ink-soft'
      }`}
    >
      <Icon active={active} />
      <span className="text-[10.5px] font-semibold tracking-[0.01em]">{label}</span>
    </Link>
  );
}

export function DesktopNav() {
  const { state } = usePhoton();
  if (!state.onboarded) return null;

  return (
    <nav aria-label="Primary" className="hidden items-center gap-1 md:flex">
      {TABS.map((t) => (
        <DesktopLink key={t.href} {...t} />
      ))}
    </nav>
  );
}

function DesktopLink({ href, label }: (typeof TABS)[number]) {
  const active = useActive(href);
  return (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      className={`rounded-pill px-3.5 py-1.5 text-[14px] transition-colors ${
        active ? 'bg-paper text-ink' : 'text-ink-faint hover:text-ink'
      }`}
    >
      {label}
    </Link>
  );
}

// ── Icons. Stroked, 1.6px, 20px box — one visual family, no filled variants. ──

function Base({ children }: { children: React.ReactNode }) {
  return (
    <svg width={20} height={20} viewBox="0 0 20 20" fill="none" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {children}
    </svg>
  );
}

function TodayIcon({ active }: { active: boolean }) {
  return (
    <Base>
      <circle cx={10} cy={10} r={7} stroke="currentColor" opacity={active ? 1 : 0.9} />
      <path d="M10 5.6v4.6l3 1.8" stroke="currentColor" />
    </Base>
  );
}

/**
 * Seven marks, one per day, the tallest in the middle. It reads as a week
 * rather than as a chart — Trends is the chart, and it is one tap deeper.
 */
function WeekIcon() {
  return (
    <Base>
      <path d="M3 17h14" stroke="currentColor" opacity={0.45} />
      <path d="M4.2 14v-2M6.8 14v-4M9.4 14v-6.5M12 14v-4.5M14.6 14v-3" stroke="currentColor" />
    </Base>
  );
}

function ChallengeIcon() {
  return (
    <Base>
      <path d="M6 3.6h8v3.2a4 4 0 0 1-8 0V3.6Z" stroke="currentColor" />
      <path d="M6 4.6H3.6v1.2A2.6 2.6 0 0 0 6 8.3M14 4.6h2.4v1.2A2.6 2.6 0 0 1 14 8.3" stroke="currentColor" opacity={0.55} />
      <path d="M10 10.8v3.1M7.2 16.4h5.6" stroke="currentColor" />
    </Base>
  );
}

function ProfileIcon() {
  return (
    <Base>
      <circle cx={10} cy={7.4} r={3} stroke="currentColor" />
      <path d="M4.4 16.4a5.8 5.8 0 0 1 11.2 0" stroke="currentColor" />
    </Base>
  );
}
