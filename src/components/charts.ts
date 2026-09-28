// SVG çizgi grafikler. Renkler CSS token'larından gelir, böylece iki temada da doğru görünür.
import { addDays, parseYmd, shortDate } from '../lib/date.ts';
import { esc } from '../lib/dom.ts';
import { fmt } from '../lib/format.ts';
import type { HistoryPoint } from '../domain/workout.ts';
import type { DateStr } from '../types.ts';

interface Pad {
  pl: number;
  pr: number;
  pt: number;
  pb: number;
}

interface Point {
  date: DateStr;
  v: number;
}

type Scale<T> = (x: T) => number;

const W = 600;
const H = 230;
const AXIS_FONT = 'font-size="12" fill="var(--ink-3)" font-family="Barlow, sans-serif"';

/** Tarihe göre x, değere göre y ölçeği. */
function scales(firstDate: DateStr, lastDate: DateStr, lo: number, hi: number, { pl, pr, pt, pb }: Pad) {
  const t0 = parseYmd(firstDate).getTime();
  const t1 = parseYmd(lastDate).getTime();
  const X: Scale<DateStr> = d =>
    pl + (t1 === t0 ? 0.5 : (parseYmd(d).getTime() - t0) / (t1 - t0)) * (W - pl - pr);
  const Y: Scale<number> = v => pt + (1 - (v - lo) / (hi - lo)) * (H - pt - pb);
  return { X, Y };
}

function grid(
  lo: number,
  hi: number,
  Y: Scale<number>,
  pl: number,
  pr: number,
  label: (v: number) => string | number,
) {
  let out = '';
  for (let i = 0; i <= 4; i++) {
    const v = lo + ((hi - lo) * i) / 4;
    const y = Y(v);
    out += `<line x1="${pl}" x2="${W - pr}" y1="${y}" y2="${y}" stroke="var(--line)" stroke-width="1"/><text x="${pl - 8}" y="${y + 4}" text-anchor="end" ${AXIS_FONT}>${label(v)}</text>`;
  }
  return out;
}

function xLabels(first: DateStr, last: DateStr, pl: number, pr: number) {
  return `<text x="${pl}" y="${H - 6}" ${AXIS_FONT}>${esc(shortDate(first))}</text><text x="${W - pr}" y="${H - 6}" text-anchor="end" ${AXIS_FONT}>${esc(shortDate(last))}</text>`;
}

const points = (arr: Point[], X: Scale<DateStr>, Y: Scale<number>) =>
  arr.map(p => `${X(p.date).toFixed(1)},${Y(p.v).toFixed(1)}`).join(' ');

/** Hareket ilerlemesi: en ağır set (kesikli) ve tahmini 1TM. `h`: exerciseHistory() çıktısı. */
export function progressChart(h: HistoryPoint[], exerciseName: string): string {
  const pad = { pl: 40, pr: 14, pt: 14, pb: 28 };
  const vals: number[] = [];
  h.forEach(x => {
    vals.push(x.top.kg);
    if (x.e1) vals.push(x.e1);
  });
  let lo = Math.min(...vals);
  let hi = Math.max(...vals);
  if (hi === lo) {
    hi += 5;
    lo = Math.max(0, lo - 5);
  }
  const padv = (hi - lo) * 0.12;
  lo = Math.max(0, lo - padv);
  hi += padv;
  const { X, Y } = scales(h[0].date, h[h.length - 1].date, lo, hi, pad);
  const e1pts = points(
    h.filter(x => x.e1).map(x => ({ date: x.date, v: x.e1 })),
    X,
    Y,
  );
  const kgpts = points(
    h.map(x => ({ date: x.date, v: x.top.kg })),
    X,
    Y,
  );
  const dots = h
    .map(
      x =>
        `<circle cx="${X(x.date)}" cy="${Y(x.top.kg)}" r="4" fill="var(--surface)" stroke="var(--ink-2)" stroke-width="2"/>` +
        (x.e1 ? `<circle cx="${X(x.date)}" cy="${Y(x.e1)}" r="4.5" fill="var(--accent)"/>` : ''),
    )
    .join('');
  return `<div class="legend"><span><i style="background:var(--accent)"></i>Tahmini 1TM</span><span><i style="background:var(--ink-2)"></i>En ağır set</span></div>
  <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(exerciseName)} ilerleme grafiği">${grid(lo, hi, Y, pad.pl, pad.pr, v => Math.round(v))}
    <polyline points="${kgpts}" fill="none" stroke="var(--ink-2)" stroke-width="2" stroke-dasharray="5 5"/>
    ${e1pts ? `<polyline points="${e1pts}" fill="none" stroke="var(--accent)" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"/>` : ''}
    ${dots}${xLabels(h[0].date, h[h.length - 1].date, pad.pl, pad.pr)}</svg>`;
}

/** Vücut ağırlığı: tartılar ve 7 günlük hareketli ortalama. `pts`: [{date, v}] eskiden yeniye. */
export function bodyChart(pts: Point[]): string {
  const pad = { pl: 44, pr: 14, pt: 14, pb: 28 };
  const vals = pts.map(p => p.v);
  let lo = Math.min(...vals);
  let hi = Math.max(...vals);
  if (hi - lo < 2) {
    const m = (hi + lo) / 2;
    lo = m - 1;
    hi = m + 1;
  }
  const pv = (hi - lo) * 0.15;
  lo -= pv;
  hi += pv;
  const { X, Y } = scales(pts[0].date, pts[pts.length - 1].date, lo, hi, pad);
  const avg = pts.map(p => {
    const from = addDays(p.date, -6);
    const win = pts.filter(q => q.date >= from && q.date <= p.date);
    return { date: p.date, v: win.reduce((a, q) => a + q.v, 0) / win.length };
  });
  const dots = pts
    .map(
      p =>
        `<circle cx="${X(p.date)}" cy="${Y(p.v)}" r="3.5" fill="var(--surface)" stroke="var(--ink-2)" stroke-width="1.6"/>`,
    )
    .join('');
  return `<div class="legend"><span><i style="background:var(--accent)"></i>7 günlük ortalama</span><span><i style="background:var(--ink-3)"></i>Tartı</span></div>
  <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Vücut ağırlığı grafiği">${grid(lo, hi, Y, pad.pl, pad.pr, v => fmt(v, 1))}
   <polyline points="${points(pts, X, Y)}" fill="none" stroke="var(--ink-3)" stroke-width="1.5"/>
   <polyline points="${points(avg, X, Y)}" fill="none" stroke="var(--accent)" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"/>
   ${dots}
   ${xLabels(pts[0].date, pts[pts.length - 1].date, pad.pl, pad.pr)}</svg>`;
}
