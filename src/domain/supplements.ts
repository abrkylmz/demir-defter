// Takviye takibi: kreatin ve protein tozu. Günlük adetler beslenme günü belgesinde (food[tarih].supp) tutulur.
import { addDays, todayStr } from '../lib/date.ts';
import { store } from '../state/store.ts';
import type { DateStr, FoodDay, SuppDay, SuppKey } from '../types.ts';

export const SUPPS: { key: SuppKey; name: string; unit: string; max: number }[] = [
  { key: 'creatine', name: 'Kreatin', unit: 'doz', max: 4 },
  { key: 'protein', name: 'Protein tozu', unit: 'ölçek', max: 6 },
];

/** Dışarıdan (bulut, yedek) gelen takviye alanını temizler; hiçbiri alınmadıysa undefined. */
export function cleanSupp(raw: unknown): SuppDay | undefined {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) return undefined;
  const o = raw as Record<string, unknown>;
  const out: SuppDay = {};
  for (const { key, max } of SUPPS) {
    const v = o[key];
    if (typeof v === 'number' && Number.isFinite(v) && v > 0) out[key] = Math.min(max, Math.round(v));
  }
  return Object.keys(out).length ? out : undefined;
}

export const suppCount = (date: DateStr, key: SuppKey): number => store.food[date]?.supp?.[key] || 0;

/** Belge boşsa buluttan silinir; takviye kaydı da içerik sayılır. */
export const foodHasContent = (d: FoodDay): boolean =>
  !!(d.items.length || d.water || (d.supp && (d.supp.creatine || d.supp.protein)));

export interface SuppStats {
  /** Son 7 / 30 günde (bugün dahil) alınan gün sayısı */
  week: number;
  month: number;
  /** Art arda alınan gün sayısı; bugün henüz alınmadıysa dünden geriye sayılır */
  streak: number;
  /** Son alındığı gün */
  last: DateStr | null;
}

export function suppStats(key: SuppKey, today: DateStr = todayStr()): SuppStats {
  let week = 0;
  let month = 0;
  for (let i = 0; i < 30; i++) {
    if (suppCount(addDays(today, -i), key) > 0) {
      month++;
      if (i < 7) week++;
    }
  }
  let streak = 0;
  let d = suppCount(today, key) > 0 ? today : addDays(today, -1);
  while (suppCount(d, key) > 0) {
    streak++;
    d = addDays(d, -1);
  }
  const last =
    Object.keys(store.food)
      .filter(date => date <= today && suppCount(date, key) > 0)
      .sort()
      .pop() ?? null;
  return { week, month, streak, last };
}

/** Herhangi bir gün takviye kaydı var mı (hafta görünümünde özet gösterilsin mi). */
export const hasAnySupp = (): boolean =>
  Object.values(store.food).some(d => d.supp && (d.supp.creatine || d.supp.protein));
