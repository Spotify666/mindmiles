import { LOOK_AWAY_MIN } from './blocks';
import { loadState, saveState } from './store';

/**
 * THE ONE NUDGE.
 *
 * The Method page has always told people the 20-20-20 rule — every twenty
 * minutes, look at something twenty feet away for twenty seconds — and then
 * never once helped them do it. An app that measures eye strain, explains the
 * remedy, and stays silent while you earn the strain is giving advice, not
 * help.
 *
 * So there is exactly one reminder in this product, and these are its rules.
 *
 * It is off until you ask for it. No permission is requested on load and no
 * notification is sent before you turn it on, because a wellbeing app that
 * interrupts you uninvited has become the thing it is measuring.
 *
 * It fires on time spent, not on the clock. Twenty minutes of screen, not
 * twenty minutes since you opened the tab — so it stays quiet while you are
 * away and never greets you with a reminder to rest from work you did not do.
 *
 * It says one thing and asks for nothing. No streak, no count of how many you
 * followed, no badge for resting. Looking out of a window is not an
 * achievement this app is qualified to award.
 *
 * And there is no second one. Every additional notification an app grants
 * itself is spent from the same attention it claims to protect, so this one has
 * to be worth its own interruption, and nothing else gets to try.
 */

const TITLE = 'Look away for twenty seconds';
const BODY = `You have been at it ${LOOK_AWAY_MIN} minutes. Find something far off and let your eyes go there — that is the whole thing.`;

export function notificationsSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window;
}

export function notificationsAllowed(): boolean {
  return notificationsSupported() && Notification.permission === 'granted';
}

export function notificationsRefused(): boolean {
  return notificationsSupported() && Notification.permission === 'denied';
}

/**
 * Ask, then switch on. Asking and enabling are one step on purpose: a prompt
 * that appears before the user has chosen anything is the pattern this file
 * exists to avoid.
 */
export async function enableReminder(): Promise<boolean> {
  if (!notificationsSupported()) return false;
  const result = Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission();
  const on = result === 'granted';
  const state = loadState();
  state.remindLookAway = on;
  saveState(state);
  return on;
}

export function disableReminder(): void {
  const state = loadState();
  state.remindLookAway = false;
  saveState(state);
}

export function reminderOn(): boolean {
  return loadState().remindLookAway === true && notificationsAllowed();
}

/**
 * Send it, through the service worker where there is one.
 *
 * A page-scoped Notification dies with the tab; the registration's version
 * survives a backgrounded tab on mobile, which is the case that matters — the
 * reminder is for someone who has been heads-down for twenty minutes, and that
 * person is not looking at this tab.
 */
export async function fireLookAway(): Promise<void> {
  if (!notificationsAllowed()) return;
  const options: NotificationOptions = {
    body: BODY,
    icon: '/icon.svg',
    badge: '/icon.svg',
    tag: 'photon-look-away',
    silent: false,
  };
  try {
    const reg = await navigator.serviceWorker?.getRegistration();
    if (reg) {
      await reg.showNotification(TITLE, options);
      return;
    }
  } catch {
    // Fall through to the page-scoped one below.
  }
  try {
    new Notification(TITLE, options);
  } catch {
    // Some browsers refuse the constructor even when permission is granted.
    // A reminder that cannot be shown is not worth an error.
  }
}

/**
 * Decide whether it is time, from engaged minutes rather than wall clock.
 *
 * `sinceBreakMin` is how long the user has been at the screen without a gap,
 * and `lastFiredAt` stops a long stretch from firing every tick once it is past
 * the threshold — one nudge per twenty minutes of work, not one per second.
 */
export function dueForLookAway(
  sinceBreakMin: number,
  lastFiredAt: number | null,
  now = Date.now(),
): boolean {
  if (sinceBreakMin < LOOK_AWAY_MIN) return false;
  if (lastFiredAt === null) return true;
  return now - lastFiredAt >= LOOK_AWAY_MIN * 60_000;
}
