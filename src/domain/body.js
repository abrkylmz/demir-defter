import { store } from '../state/store.js';

/** Tartı girilen günler, eskiden yeniye. */
export const bodyDates = () => Object.keys(store.body).sort();

/** Sıralı listede hedef tarihe eşit ya da ondan önceki en yakın tarih. */
export function nearestBefore(dates, target) {
  let r = null;
  for (const d of dates) {
    if (d <= target) r = d;
    else break;
  }
  return r;
}

export function latestWeight() {
  const ds = bodyDates();
  return ds.length ? store.body[ds[ds.length - 1]] : null;
}
