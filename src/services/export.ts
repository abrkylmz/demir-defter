import { mealName } from '../data/foods.ts';
import { bodyDates } from '../domain/body.ts';
import { itemVals } from '../domain/nutrition.ts';
import { sortedDates } from '../domain/workout.ts';
import { todayStr } from '../lib/date.ts';
import { store } from '../state/store.ts';
import { toast } from '../ui/toast.ts';
import { saveFile } from './files.ts';

const BOM = String.fromCharCode(0xfeff);
type Cell = string | number;

const round1 = (n: number) => Math.round(n * 10) / 10;

const csvCell = (c: Cell) => {
  const s = String(c);
  return /[",;\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
};

/** Tüm kayıtlar tek CSV'de: antrenman setleri, tartılar, ardından beslenme. */
export function buildCsv() {
  const rows: Cell[][] = [['Tarih', 'Hareket', 'Kas grubu', 'Set', 'Kg', 'Tekrar', 'Not']];
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

/** Excel/Sheets için CSV indirir. */
export async function exportCsv() {
  try {
    await saveFile(`demir-defter-${todayStr()}.csv`, buildCsv(), 'text/csv;charset=utf-8');
  } catch {
    toast('Dosya şu an indirilemiyor');
  }
}
