import { store } from '../state/store.ts';
import type { DateStr } from '../types.ts';

/** Tartı girilen günler, eskiden yeniye. */
export const bodyDates = (): DateStr[] => Object.keys(store.body).sort();

/** Sıralı listede hedef tarihe eşit ya da ondan önceki en yakın tarih. */
export function nearestBefore(dates: DateStr[], target: DateStr): DateStr | null {
  let r: DateStr | null = null;
  for (const d of dates) {
    if (d <= target) r = d;
    else break;
  }
  return r;
}

export function latestWeight(): number | null {
  const ds = bodyDates();
  return ds.length ? store.body[ds[ds.length - 1]] : null;
}
