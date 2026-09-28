// Tarihler uygulama boyunca yerel saatle "YYYY-MM-DD" string olarak taşınır.
import type { DateStr } from '../types.ts';

const pad = (n: number) => String(n).padStart(2, '0');

export const ymd = (d: Date): DateStr => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export const parseYmd = (s: DateStr): Date => {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
};

export const addDays = (s: DateStr, n: number): DateStr => {
  const d = parseYmd(s);
  d.setDate(d.getDate() + n);
  return ymd(d);
};

export const todayStr = (): DateStr => ymd(new Date());

/** Haftanın pazartesisi (hafta pazartesi başlar). */
export const mondayOf = (s: DateStr): DateStr => {
  const d = parseYmd(s);
  const weekday = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - weekday);
  return ymd(d);
};

export const DAY_NAMES = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'];

const tr = (s: DateStr, opts: Intl.DateTimeFormatOptions) => parseYmd(s).toLocaleDateString('tr-TR', opts);
export const longDate = (s: DateStr) => tr(s, { day: 'numeric', month: 'long', weekday: 'long' });
export const monthYear = (s: DateStr) => tr(s, { month: 'long', year: 'numeric' });
export const shortDate = (s: DateStr) => tr(s, { day: 'numeric', month: 'short' });
export const dayMonth = (s: DateStr) => tr(s, { day: 'numeric', month: 'long' });
export const weekdayLong = (s: DateStr) => tr(s, { weekday: 'long' });
export const weekdayShort = (s: DateStr) => tr(s, { weekday: 'short' });

/** İki tarih arasındaki gün farkı (b - a). */
export const daysBetween = (a: DateStr, b: DateStr): number =>
  Math.round((parseYmd(b).getTime() - parseYmd(a).getTime()) / 86400000);

/** "bugün", "dün", "5 gün önce" */
export function daysAgoText(date: DateStr): string {
  const n = daysBetween(date, todayStr());
  if (n <= 0) return 'bugün';
  if (n === 1) return 'dün';
  return `${n} gün önce`;
}

/** "Bugün", "Dün" ya da "12 Mart". */
export function relativeDayTitle(date: DateStr): string {
  const t = todayStr();
  if (date === t) return 'Bugün';
  if (date === addDays(t, -1)) return 'Dün';
  return dayMonth(date);
}
