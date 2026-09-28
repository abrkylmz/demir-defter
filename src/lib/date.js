// Tarihler uygulama boyunca yerel saatle "YYYY-MM-DD" string olarak taşınır.

const pad = n => String(n).padStart(2, '0');

export const ymd = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export const parseYmd = s => {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
};

export const addDays = (s, n) => {
  const d = parseYmd(s);
  d.setDate(d.getDate() + n);
  return ymd(d);
};

export const todayStr = () => ymd(new Date());

/** Haftanın pazartesisi (hafta pazartesi başlar). */
export const mondayOf = s => {
  const d = parseYmd(s);
  const weekday = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - weekday);
  return ymd(d);
};

export const DAY_NAMES = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'];

const tr = (s, opts) => parseYmd(s).toLocaleDateString('tr-TR', opts);
export const longDate = s => tr(s, { day: 'numeric', month: 'long', weekday: 'long' });
export const monthYear = s => tr(s, { month: 'long', year: 'numeric' });
export const shortDate = s => tr(s, { day: 'numeric', month: 'short' });
export const dayMonth = s => tr(s, { day: 'numeric', month: 'long' });
export const weekdayLong = s => tr(s, { weekday: 'long' });
export const weekdayShort = s => tr(s, { weekday: 'short' });

/** İki tarih arasındaki gün farkı (b - a). */
export const daysBetween = (a, b) => Math.round((parseYmd(b) - parseYmd(a)) / 86400000);

/** "bugün", "dün", "5 gün önce" */
export function daysAgoText(date) {
  const n = daysBetween(date, todayStr());
  if (n <= 0) return 'bugün';
  if (n === 1) return 'dün';
  return `${n} gün önce`;
}

/** "Bugün", "Dün" ya da "12 Mart". */
export function relativeDayTitle(date) {
  const t = todayStr();
  if (date === t) return 'Bugün';
  if (date === addDays(t, -1)) return 'Dün';
  return dayMonth(date);
}
