import { fmtSigned } from './format';

/** "Today · Tue 24 Jun", or the date itself when looking back. */
export function todayLabel(iso: string): string {
  const today = new Date();
  const key = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const pretty = new Date(`${iso}T12:00:00`).toLocaleDateString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
  return iso === key ? `Today · ${pretty}` : pretty;
}

export { fmtSigned };
