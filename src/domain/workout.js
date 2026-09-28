// Antrenman verisi üzerindeki sorgular. Yalnızca okur; değişiklikler çağıran tarafta persistSession ile kaydedilir.
import { LIB, OTHER_GROUP } from '../data/exercises.js';
import { e1rm } from '../lib/fitness.js';
import { nameKey } from '../lib/format.js';
import { store } from '../state/store.js';

/** Kütüphanede ya da özel hareketlerde isimle arar. */
export function libInfo(name) {
  const k = nameKey(name);
  for (const [group, list] of LIB)
    for (const [n, bar] of list) if (nameKey(n) === k) return { name: n, group, bar: !!bar };
  const c = store.custom.find(x => nameKey(x.name) === k);
  if (c) return { name: c.name, group: c.group || OTHER_GROUP, bar: !!c.bar };
  return null;
}

export function allExercises() {
  const out = [];
  LIB.forEach(([group, list]) => list.forEach(([name, bar]) => out.push({ name, group, bar: !!bar })));
  store.custom.forEach(c => {
    if (!out.some(o => nameKey(o.name) === nameKey(c.name)))
      out.push({ name: c.name, group: c.group || OTHER_GROUP, bar: !!c.bar, custom: true });
  });
  return out;
}

export function session(date, create) {
  if (!store.sessions[date] && create) store.sessions[date] = { date, exercises: [] };
  return store.sessions[date];
}

/** En az bir set girilmiş günler, eskiden yeniye. */
export function sortedDates() {
  return Object.keys(store.sessions)
    .filter(d => (store.sessions[d].exercises || []).some(e => e.sets.length))
    .sort();
}

/** Hareketin verilen tarihten önceki son kaydı. */
export function lastTime(name, beforeDate) {
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
export function exerciseHistory(name) {
  const k = nameKey(name);
  const out = [];
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
export function bestE1(name, exclude) {
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
export function loggedNames() {
  const m = new Map();
  sortedDates().forEach(d =>
    store.sessions[d].exercises.forEach(e => {
      if (e.sets.length) m.set(nameKey(e.name), e.name);
    }),
  );
  return [...m.values()].sort((a, b) => a.localeCompare(b, 'tr'));
}

export function recentNames(limit) {
  const seen = new Set();
  const out = [];
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
export function groupSets(from, to) {
  const m = {};
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
