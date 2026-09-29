// Haftalık / aylık rapor: antrenman, beslenme ve kilo özetleri, önceki döneme göre değişim ve öne çıkanlar.
// Yalnızca okur; DOM'dan bağımsız (tests/report.test.ts).
import { GROUPS, OTHER_GROUP } from '../data/exercises.ts';
import { addDays, mondayOf, parseYmd, todayStr, ymd } from '../lib/date.ts';
import { e1rm } from '../lib/fitness.ts';
import { nameKey } from '../lib/format.ts';
import { store } from '../state/store.ts';
import type { DateStr } from '../types.ts';
import { bodyDates, nearestBefore } from './body.ts';
import { dayTotals, kcalStatus } from './nutrition.ts';
import { weeklyGoal } from './weekly.ts';
import { groupSets, sortedDates } from './workout.ts';

export type Period = 'week' | 'month';

export interface Range {
  from: DateStr;
  to: DateStr;
  days: DateStr[];
}

export function periodRange(period: Period, anchor: DateStr): Range {
  let from: DateStr;
  let to: DateStr;
  if (period === 'week') {
    from = mondayOf(anchor);
    to = addDays(from, 6);
  } else {
    const d = parseYmd(anchor);
    from = ymd(new Date(d.getFullYear(), d.getMonth(), 1));
    to = ymd(new Date(d.getFullYear(), d.getMonth() + 1, 0));
  }
  const days: DateStr[] = [];
  for (let x = from; x <= to; x = addDays(x, 1)) days.push(x);
  return { from, to, days };
}

/** Bir önceki dönemin herhangi bir günü (gezinme ve karşılaştırma için). */
export const previousAnchor = (period: Period, anchor: DateStr): DateStr =>
  addDays(periodRange(period, anchor).from, -1);

export const nextAnchor = (period: Period, anchor: DateStr): DateStr =>
  addDays(periodRange(period, anchor).to, 1);

// ---------- bölümler ----------

export interface WorkoutStats {
  sessions: number;
  goal: number;
  sets: number;
  /** kg × tekrar toplamı (vücut ağırlığı setleri hariç) */
  volume: number;
}

function workoutStats(r: Range, period: Period): WorkoutStats {
  const dates = sortedDates().filter(d => d >= r.from && d <= r.to);
  let sets = 0;
  let volume = 0;
  for (const d of dates)
    for (const e of store.sessions[d].exercises)
      for (const t of e.sets) {
        sets++;
        volume += t.kg * t.reps;
      }
  const goal = period === 'week' ? weeklyGoal() : Math.round((weeklyGoal() * r.days.length) / 7);
  return { sessions: dates.length, goal, sets, volume };
}

export interface RecordEvent {
  name: string;
  date: DateStr;
  /** yeni tahmini 1TM */
  value: number;
  /** önceki en iyi */
  prev: number;
}

/** Dönemde kırılan 1TM rekorları (bir hareketin ilk kaydı rekor sayılmaz). */
export function recordEvents(from: DateStr, to: DateStr): RecordEvent[] {
  const best = new Map<string, number>();
  const out: RecordEvent[] = [];
  for (const d of sortedDates()) {
    if (d > to) break;
    for (const e of store.sessions[d].exercises) {
      const k = nameKey(e.name);
      const dayBest = Math.max(0, ...e.sets.map(t => e1rm(t.kg, t.reps)));
      if (!dayBest) continue;
      const prev = best.get(k);
      if (prev !== undefined && dayBest > prev + 1e-9 && d >= from)
        out.push({ name: e.name, date: d, value: dayBest, prev });
      if (prev === undefined || dayBest > prev) best.set(k, dayBest);
    }
  }
  return out;
}

export interface DayNutrition {
  date: DateStr;
  /** kayıt yoksa null */
  k: number | null;
  p: number | null;
}

export interface NutritionStats {
  days: DayNutrition[];
  logged: number;
  avgK: number | null;
  avgP: number | null;
  goalK: number | null;
  goalP: number | null;
  /** kalori hedefinin ±%10'unda kalınan gün (bugün, henüz bitmediği için sayılmaz) */
  kcalHit: number;
  /** protein hedefinin en az %90'ına ulaşılan gün */
  proteinHit: number;
}

function nutritionStats(r: Range): NutritionStats {
  const g = store.goals;
  const days = r.days.map(date => {
    const has = !!store.food[date]?.items.length;
    const t = has ? dayTotals(date) : null;
    return { date, k: t ? t.k : null, p: t ? t.p : null };
  });
  const logged = days.filter(d => d.k !== null);
  const avg = (key: 'k' | 'p') =>
    logged.length ? logged.reduce((a, d) => a + (d[key] as number), 0) / logged.length : null;
  return {
    days,
    logged: logged.length,
    avgK: avg('k'),
    avgP: avg('p'),
    goalK: g?.kcal || null,
    goalP: g?.p || null,
    kcalHit: logged.filter(d => kcalStatus(d.date)?.cls === 'ok').length,
    proteinHit: g?.p ? logged.filter(d => (d.p as number) >= g.p * 0.9).length : 0,
  };
}

export interface BodyStats {
  start: number | null;
  end: number | null;
  change: number | null;
  entries: number;
}

function bodyStats(r: Range): BodyStats {
  const all = bodyDates();
  const inRange = all.filter(d => d >= r.from && d <= r.to);
  if (!inRange.length) return { start: null, end: null, change: null, entries: 0 };
  // Başlangıç: dönemden önceki son tartı; yoksa dönemin ilk tartısı
  const before = nearestBefore(all, addDays(r.from, -1));
  const start = store.body[before ?? inRange[0]];
  const end = store.body[inRange[inRange.length - 1]];
  const change = before || inRange.length > 1 ? end - start : null;
  return { start, end, change, entries: inRange.length };
}

// ---------- rapor ----------

export interface Report {
  period: Period;
  range: Range;
  /** dönem bugünü içeriyor mu (henüz bitmedi) */
  current: boolean;
  workout: WorkoutStats;
  prevWorkout: WorkoutStats;
  groups: { group: string; sets: number }[];
  missingGroups: string[];
  records: RecordEvent[];
  nutrition: NutritionStats;
  prevNutrition: NutritionStats;
  body: BodyStats;
  insights: string[];
}

const fmt0 = (n: number) => Math.round(n).toLocaleString('tr-TR');
const fmt1 = (n: number) => n.toLocaleString('tr-TR', { maximumFractionDigits: 1 });

export function buildReport(period: Period, anchor: DateStr, today: DateStr = todayStr()): Report {
  const range = periodRange(period, anchor);
  const prevRange = periodRange(period, previousAnchor(period, anchor));
  const workout = workoutStats(range, period);
  const nutrition = nutritionStats(range);
  const body = bodyStats(range);
  const gs = groupSets(range.from, range.to);
  const groups = Object.entries(gs)
    .map(([group, sets]) => ({ group, sets }))
    .sort((a, b) => b.sets - a.sets || a.group.localeCompare(b.group, 'tr'));
  const missingGroups = workout.sessions ? GROUPS.filter(g => g !== OTHER_GROUP && !gs[g]) : [];
  const report: Report = {
    period,
    range,
    current: today >= range.from && today <= range.to,
    workout,
    prevWorkout: workoutStats(prevRange, period),
    groups,
    missingGroups,
    records: recordEvents(range.from, range.to),
    nutrition,
    prevNutrition: nutritionStats(prevRange),
    body,
    insights: [],
  };
  report.insights = insightsFor(report);
  return report;
}

/** Kısa, somut cümleler; en fazla 5. Yargı kelimelerle verilir (renge bırakılmaz). */
function insightsFor(r: Report): string[] {
  const out: string[] = [];
  const w = r.workout;
  const unit = r.period === 'week' ? 'hafta' : 'ay';
  if (w.sessions >= w.goal && w.goal > 0) out.push(`Antrenman hedefin tamam: ${w.sessions}/${w.goal}.`);
  else if (r.current && w.goal > w.sessions) out.push(`Hedefe ${w.goal - w.sessions} antrenman kaldı.`);
  else if (w.goal > 0) out.push(`Bu ${unit} ${w.sessions}/${w.goal} antrenman yaptın.`);

  if (r.records.length) {
    const top = [...r.records].sort((a, b) => b.value - b.prev - (a.value - a.prev))[0];
    out.push(
      r.records.length === 1
        ? `${top.name} rekoru: tahmini 1TM ${fmt0(top.prev)} → ${fmt0(top.value)} kg.`
        : `${r.records.length} rekor kırdın; en büyük artış ${top.name} (+${fmt1(top.value - top.prev)} kg).`,
    );
  }
  if (r.missingGroups.length && r.missingGroups.length <= 3)
    out.push(`Bu ${unit} çalışılmayan kas grubu: ${r.missingGroups.join(', ')}.`);

  const n = r.nutrition;
  if (n.logged && n.goalP) out.push(`Protein hedefini ${n.logged} günün ${n.proteinHit} gününde tutturdun.`);
  else if (!n.logged) out.push(`Bu ${unit} beslenme kaydı yok.`);

  const b = r.body;
  if (b.change !== null && Math.abs(b.change) >= 0.1 && n.avgK !== null && n.goalK) {
    // Mutlak değer üzerinden yuvarla: Math.round(-12.5) = -12 ama 12.5 → 13 olurdu
    const ratio = (n.avgK - n.goalK) / n.goalK;
    const pct = Math.round(Math.abs(ratio) * 100);
    const dir = b.change < 0 ? 'düştü' : 'arttı';
    const rel = pct === 0 ? 'hedefinde' : `hedefinin %${pct} ${ratio < 0 ? 'altında' : 'üstünde'}`;
    out.push(`Kilon ${fmt1(Math.abs(b.change))} kg ${dir}; ortalama kalorin ${rel}.`);
  } else if (b.change !== null && Math.abs(b.change) >= 0.1) {
    out.push(`Kilon ${fmt1(Math.abs(b.change))} kg ${b.change < 0 ? 'düştü' : 'arttı'}.`);
  }
  return out.slice(0, 5);
}

/** Önceki döneme göre yüzde değişim; karşılaştırılamıyorsa null. */
export const pctChange = (now: number | null, prev: number | null): number | null =>
  now === null || prev === null || prev === 0 ? null : Math.round(((now - prev) / prev) * 100);
