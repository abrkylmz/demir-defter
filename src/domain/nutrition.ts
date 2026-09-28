import { FOODS, MY_FOODS_CAT } from '../data/foods.ts';
import { addDays, todayStr } from '../lib/date.ts';
import { nameKey } from '../lib/format.ts';
import { store } from '../state/store.ts';
import type { DateStr, Food, FoodDay, FoodItem, Macros } from '../types.ts';

export function foodDay(date: DateStr, create: true): FoodDay;
export function foodDay(date: DateStr, create?: boolean): FoodDay | undefined;
export function foodDay(date: DateStr, create?: boolean): FoodDay | undefined {
  if (!store.food[date] && create) store.food[date] = { items: [], water: 0 };
  return store.food[date];
}

export function allFoods(): Food[] {
  const out: Food[] = FOODS.map(f => ({
    name: f[0],
    cat: f[1],
    k: f[2],
    p: f[3],
    c: f[4],
    f: f[5],
    pl: f[6],
    pg: f[7],
  }));
  store.foodCustom.forEach(c => {
    if (!out.some(o => nameKey(o.name) === nameKey(c.name)))
      out.push(Object.assign({ cat: MY_FOODS_CAT, mine: true }, c));
  });
  return out;
}

/** Bir kaydın gramajına göre kcal / protein / karb / yağ. */
export const itemVals = (it: FoodItem): Macros => {
  const r = it.g / 100;
  return { k: it.per.k * r, p: it.per.p * r, c: it.per.c * r, f: it.per.f * r };
};

export function dayTotals(date: DateStr): Macros {
  const d = store.food[date];
  const t = { k: 0, p: 0, c: 0, f: 0 };
  if (d)
    d.items.forEach(it => {
      const v = itemVals(it);
      t.k += v.k;
      t.p += v.p;
      t.c += v.c;
      t.f += v.f;
    });
  return t;
}

export function recentFoods(limit: number): FoodItem[] {
  const seen = new Set<string>();
  const out: FoodItem[] = [];
  Object.keys(store.food)
    .sort()
    .reverse()
    .forEach(d =>
      store.food[d].items
        .slice()
        .reverse()
        .forEach(it => {
          const k = nameKey(it.name);
          if (!seen.has(k)) {
            seen.add(k);
            out.push(it);
          }
        }),
    );
  return out.slice(0, limit);
}

/**
 * Günün kalori durumu (hafta şeridindeki renk için).
 * cls: ok (hedefin ±%10'u) | miss | pending (bugün, henüz altında) | none (hedef yok)
 */
export interface KcalStatus {
  k: number;
  cls: 'ok' | 'miss' | 'pending' | 'none';
  txt: string;
}

export function kcalStatus(date: DateStr): KcalStatus | null {
  const d = store.food[date];
  if (!d || !d.items.length) return null;
  const k = dayTotals(date).k;
  const g = store.goals;
  if (!g || !g.kcal) return { k, cls: 'none', txt: '' };
  const r = k / g.kcal;
  if (r >= 0.9 && r <= 1.1) return { k, cls: 'ok', txt: 'hedefte' };
  if (date === todayStr() && r < 0.9) return { k, cls: 'pending', txt: 'gün devam ediyor' };
  return { k, cls: 'miss', txt: r < 0.9 ? 'hedefin altında' : 'hedefin üstünde' };
}

/** Son 7 günde kayıt girilen günlerin ortalaması; 2 günden azsa null. */
export function recentAverage(): { days: number; k: number; p: number } | null {
  const t = todayStr();
  const days: Macros[] = [];
  for (let i = 0; i < 7; i++) {
    const d = addDays(t, -i);
    if (store.food[d] && store.food[d].items.length) days.push(dayTotals(d));
  }
  if (days.length < 2) return null;
  const sum = (key: keyof Macros) => days.reduce((a, x) => a + x[key], 0);
  return { days: days.length, k: sum('k') / days.length, p: sum('p') / days.length };
}
