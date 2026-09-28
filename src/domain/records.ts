// Kişisel rekorlar: her hareket için en iyi tahmini 1TM, en ağır set ve en çok tekrar.
import { addDays, todayStr } from '../lib/date.ts';
import { e1rm } from '../lib/fitness.ts';
import { nameKey } from '../lib/format.ts';
import { store } from '../state/store.ts';
import type { DateStr, SetEntry } from '../types.ts';
import { sortedDates } from './workout.ts';

export interface RecordEntry<T> {
  value: T;
  date: DateStr;
}

export interface ExerciseRecords {
  name: string;
  group: string;
  /** Tahmini 1TM (yalnızca ağırlıklı ve ≤12 tekrarlı setlerden) */
  e1?: RecordEntry<number>;
  /** En ağır set (eşitse en çok tekrarlı) */
  heaviest?: RecordEntry<SetEntry>;
  /** Tek sette en çok tekrar */
  mostReps?: RecordEntry<SetEntry>;
  /** Herhangi bir rekorun kırıldığı en son tarih */
  latest: DateStr;
  sessions: number;
}

/** Tüm hareketlerin rekorları; en son rekor kırılan en üstte. */
export function allRecords(): ExerciseRecords[] {
  const map = new Map<string, ExerciseRecords>();
  // Kronolojik gez: rekor ancak öncekini aşarsa güncellenir, böylece tarih ilk kırıldığı gün olur.
  for (const d of sortedDates()) {
    for (const e of store.sessions[d].exercises) {
      if (!e.sets.length) continue;
      const k = nameKey(e.name);
      let r = map.get(k);
      if (!r) {
        r = { name: e.name, group: e.group, latest: d, sessions: 0 };
        map.set(k, r);
      }
      r.sessions++;
      for (const t of e.sets) {
        const est = e1rm(t.kg, t.reps);
        if (est > 0 && (!r.e1 || est > r.e1.value + 1e-9)) {
          r.e1 = { value: est, date: d };
          r.latest = d;
        }
        const h = r.heaviest?.value;
        if (!h || t.kg > h.kg || (t.kg === h.kg && t.reps > h.reps)) {
          r.heaviest = { value: t, date: d };
          r.latest = d;
        }
        if (!r.mostReps || t.reps > r.mostReps.value.reps) {
          r.mostReps = { value: t, date: d };
          r.latest = d;
        }
      }
    }
  }
  return [...map.values()].sort((a, b) => (a.latest < b.latest ? 1 : a.latest > b.latest ? -1 : 0));
}

/** Son 7 gün içinde kırılmış mı? */
export const isFresh = (date: DateStr, today: DateStr = todayStr()): boolean => date > addDays(today, -7);
