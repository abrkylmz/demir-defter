// Antrenman verisi üzerindeki sorgular. Yalnızca okur; değişiklikler çağıran tarafta persistSession ile kaydedilir.
import { LIB, OTHER_GROUP } from '../data/exercises.ts';
import { e1rm } from '../lib/fitness.ts';
import { nameKey } from '../lib/format.ts';
import { store } from '../state/store.ts';
import type { DateStr, ExerciseInfo, Session, SetEntry } from '../types.ts';

export interface HistoryPoint {
  date: DateStr;
  /** günün en ağır seti */
  top: SetEntry;
  /** günün en iyi tahmini 1TM'i */
  e1: number;
  sets: number;
  vol: number;
}

export interface LastTime {
  date: DateStr;
  sets: SetEntry[];
  note?: string;
}

/** Kütüphanede ya da özel hareketlerde isimle arar. */
export function libInfo(name: string): ExerciseInfo | null {
  const k = nameKey(name);
  for (const [group, list] of LIB)
    for (const [n, bar] of list) if (nameKey(n) === k) return { name: n, group, bar: !!bar };
  const c = store.custom.find(x => nameKey(x.name) === k);
  if (c) return { name: c.name, group: c.group || OTHER_GROUP, bar: !!c.bar };
  return null;
}

export function allExercises(): (ExerciseInfo & { custom?: boolean })[] {
  const out: (ExerciseInfo & { custom?: boolean })[] = [];
  LIB.forEach(([group, list]) => list.forEach(([name, bar]) => out.push({ name, group, bar: !!bar })));
  store.custom.forEach(c => {
    if (!out.some(o => nameKey(o.name) === nameKey(c.name)))
      out.push({ name: c.name, group: c.group || OTHER_GROUP, bar: !!c.bar, custom: true });
  });
  return out;
}

export function session(date: DateStr, create: true): Session;
export function session(date: DateStr, create?: boolean): Session | undefined;
export function session(date: DateStr, create?: boolean): Session | undefined {
  if (!store.sessions[date] && create) store.sessions[date] = { date, exercises: [] };
  return store.sessions[date];
}

/** En az bir set girilmiş günler, eskiden yeniye. */
export function sortedDates(): DateStr[] {
  return Object.keys(store.sessions)
    .filter(d => (store.sessions[d].exercises || []).some(e => e.sets.length))
    .sort();
}

/** Hareketin verilen tarihten önceki son kaydı. */
export function lastTime(name: string, beforeDate: DateStr): LastTime | null {
  const k = nameKey(name);
  const dates = sortedDates()
    .filter(d => d < beforeDate)
    .reverse();
  for (const d of dates) {
    const e = store.sessions[d].exercises.find(x => nameKey(x.name) === k && x.sets.length);
    if (e) return { date: d, sets: e.sets, note: e.note };
  }
  return null;
}

/** Hareketin gün gün özeti: en ağır set, en iyi tahmini 1TM, set sayısı, hacim. */
export function exerciseHistory(name: string): HistoryPoint[] {
  const k = nameKey(name);
  const out: HistoryPoint[] = [];
  sortedDates().forEach(d => {
    store.sessions[d].exercises.forEach(e => {
      if (nameKey(e.name) !== k || !e.sets.length) return;
      let top = e.sets[0];
      let best = 0;
      let vol = 0;
      e.sets.forEach(t => {
        if (t.kg > top.kg || (t.kg === top.kg && t.reps > top.reps)) top = t;
        const r = e1rm(t.kg, t.reps);
        if (r > best) best = r;
        vol += t.kg * t.reps;
      });
      out.push({ date: d, top, e1: best, sets: e.sets.length, vol });
    });
  });
  return out;
}

/** Tüm zamanların en iyi tahmini 1TM'i; `exclude` seti hesaba katılmaz (düzenlenen set için). */
export function bestE1(name: string, exclude?: SetEntry | null): number {
  const k = nameKey(name);
  let best = 0;
  Object.values(store.sessions).forEach(s =>
    s.exercises.forEach(e => {
      if (nameKey(e.name) !== k) return;
      e.sets.forEach(t => {
        if (t === exclude) return;
        const r = e1rm(t.kg, t.reps);
        if (r > best) best = r;
      });
    }),
  );
  return best;
}

/** Set girilmiş tüm hareket adları, alfabetik. */
export function loggedNames(): string[] {
  const m = new Map<string, string>();
  sortedDates().forEach(d =>
    store.sessions[d].exercises.forEach(e => {
      if (e.sets.length) m.set(nameKey(e.name), e.name);
    }),
  );
  return [...m.values()].sort((a, b) => a.localeCompare(b, 'tr'));
}

export function recentNames(limit: number): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  sortedDates()
    .reverse()
    .forEach(d =>
      store.sessions[d].exercises.forEach(e => {
        const k = nameKey(e.name);
        if (!seen.has(k)) {
          seen.add(k);
          out.push(e.name);
        }
      }),
    );
  return out.slice(0, limit);
}

/** [from, to] aralığında kas grubu başına set sayısı. */
export function groupSets(from: DateStr, to: DateStr): Record<string, number> {
  const m: Record<string, number> = {};
  Object.keys(store.sessions).forEach(d => {
    if (d < from || d > to) return;
    store.sessions[d].exercises.forEach(e => {
      if (!e.sets.length) return;
      const g = e.group || OTHER_GROUP;
      m[g] = (m[g] || 0) + e.sets.length;
    });
  });
  return m;
}
