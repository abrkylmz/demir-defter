import { mealName } from '../data/foods.js';
import { bodyDates } from '../domain/body.js';
import { itemVals } from '../domain/nutrition.js';
import { sortedDates } from '../domain/workout.js';
import { todayStr } from '../lib/date.js';
import { store } from '../state/store.js';
import { toast } from '../ui/toast.js';
import { cloud } from './db.js';

const BOM = String.fromCharCode(0xfeff);
const round1 = n => Math.round(n * 10) / 10;

const csvCell = c => {
  const s = String(c);
  return /[",;\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
};

/** Tüm kayıtlar tek CSV'de: antrenman setleri, tartılar, ardından beslenme. */
export function buildCsv() {
  const rows = [['Tarih', 'Hareket', 'Kas grubu', 'Set', 'Kg', 'Tekrar', 'Not']];
  sortedDates().forEach(d => {
    const s = store.sessions[d];
    if (s.note) rows.push([d, 'Günün notu', '', '', '', '', s.note]);
    s.exercises.forEach(e =>
      e.sets.forEach((t, j) =>
        rows.push([d, e.name, e.group || '', j + 1, t.kg, t.reps, j === 0 ? e.note || '' : '']),
      ),
    );
  });
  bodyDates().forEach(d => rows.push([d, 'Vücut ağırlığı', '', '', store.body[d], '']));
  rows.push([]);
  rows.push(['Tarih', 'Öğün', 'Besin', 'Gram', 'Kalori', 'Protein', 'Karbonhidrat', 'Yağ']);
  Object.keys(store.food)
    .sort()
    .forEach(d =>
      store.food[d].items.forEach(it => {
        const v = itemVals(it);
        rows.push([
          d,
          mealName(it.meal),
          it.name,
          it.g,
          Math.round(v.k),
          round1(v.p),
          round1(v.c),
          round1(v.f),
        ]);
      }),
    );
  // BOM: Excel'in Türkçe karakterleri doğru açması için
  return BOM + rows.map(r => r.map(csvCell).join(',')).join('\n');
}

export async function exportCsv() {
  if (!cloud.downloads) return;
  try {
    await cloud.downloads.save({ filename: `demir-defter-${todayStr()}.csv`, data: buildCsv() });
  } catch (err) {
    if (err && err.code !== 'declined') toast('Dosya şu an indirilemiyor');
  }
}
