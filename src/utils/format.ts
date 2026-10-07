import { toUtc } from '../core/calendar';
import type { IsoDate } from '../core/types';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function monthName(index: number): string {
  return MONTHS[index] ?? '';
}

/** `Oct 7` */
export function formatShort(date: IsoDate | null | undefined): string {
  if (!date) return '';
  const d = new Date(toUtc(date));
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}`;
}

/** `Wed, Oct 7, 2026` */
export function formatLong(date: IsoDate | null | undefined): string {
  if (!date) return '-';
  const d = new Date(toUtc(date));
  return `${DAYS[d.getUTCDay()]}, ${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}`;
}

/** `Oct 7, 2026` */
export function formatMedium(date: IsoDate | null | undefined): string {
  if (!date) return '-';
  const d = new Date(toUtc(date));
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}`;
}

export function formatRange(start: IsoDate, end: IsoDate): string {
  return start === end ? formatMedium(start) : `${formatMedium(start)} - ${formatMedium(end)}`;
}
