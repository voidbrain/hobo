// Framework-free domain code: no Angular imports (eslint and check:conventions enforce it).

/** How long a place takes on site, queues and movement on site included. */
export type TimeSpent = '2h' | 'half-day' | 'full-day';

export const TIME_SPENT_OPTIONS: readonly TimeSpent[] = ['2h', 'half-day', 'full-day'];

const MINUTES: Record<TimeSpent, number> = {
  '2h': 120,
  'half-day': 240,
  'full-day': 480,
};

/** Minutes a stop of this kind adds to a day. */
export function timeSpentMinutes(spent: TimeSpent): number {
  return MINUTES[spent];
}

/** 135 → "2 h 15 min", 120 → "2 h", 45 → "45 min". */
export function formatMinutes(total: number): string {
  if (!Number.isFinite(total) || total < 0) throw new RangeError(`Not a duration: ${total}`);
  const rounded = Math.round(total);
  const hours = Math.floor(rounded / 60);
  const minutes = rounded % 60;
  if (hours === 0) return `${minutes} min`;
  return minutes === 0 ? `${hours} h` : `${hours} h ${minutes} min`;
}
