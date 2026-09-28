import { bodyDates, nearestBefore } from '../domain/body.js';
import { todayStr } from '../lib/date.js';
import { parseDecimal } from '../lib/dom.js';
import { fmt } from '../lib/format.js';
import { persistBody } from '../services/persist.js';
import { store } from '../state/store.js';
import { closeSheet, openSheet } from '../ui/sheet.js';
import { toast } from '../ui/toast.js';

const DEFAULT_KG = 75;
const MIN_KG = 20;
const MAX_KG = 400;

/** Tartı ekleme / düzenleme. Tarih değiştirilirse kayıt yeni tarihe taşınır. */
export function openBodySheet(date) {
  const exists = store.body[date] !== undefined;
  const ds = bodyDates();
  const ref = nearestBefore(ds, date);
  const initial = exists
    ? store.body[date]
    : ref
      ? store.body[ref]
      : ds.length
        ? store.body[ds[ds.length - 1]]
        : DEFAULT_KG;

  openSheet(
    `<h2>Vücut ağırlığı</h2><div class="sub">${exists ? 'Kaydı düzenle' : 'Yeni tartı'}</div>
    <div class="field"><label for="bwDate">Tarih</label><input id="bwDate" class="date" type="date" value="${date}" max="${todayStr()}"></div>
    <div class="field"><label for="bwIn">Kilo (kg)</label>
      <div class="stepper"><button type="button" data-bd="-0.1" aria-label="100 gram azalt">−</button>
      <input id="bwIn" class="num" inputmode="decimal" autocomplete="off" value="${fmt(initial, 1)}">
      <button type="button" data-bd="0.1" aria-label="100 gram artır">+</button></div></div>
    <div class="sheetactions">${exists ? '<button class="btn danger" id="bwDel">Sil</button>' : ''}<button class="btn primary grow" id="bwSave">Kaydet</button></div>`,
    sh => {
      const input = sh.querySelector('#bwIn');
      const dateInput = sh.querySelector('#bwDate');
      const read = () => {
        const x = parseDecimal(input.value);
        return isNaN(x) ? 0 : x;
      };
      input.addEventListener('focus', () => input.select());
      sh.querySelectorAll('[data-bd]').forEach(b =>
        b.addEventListener('click', () => {
          input.value = fmt(Math.max(0, Math.round((read() + parseFloat(b.dataset.bd)) * 10) / 10), 1);
        }),
      );

      const save = () => {
        const kg = read();
        const d = dateInput.value;
        if (!(kg >= MIN_KG && kg <= MAX_KG)) {
          toast(`Geçerli bir kilo gir (${MIN_KG}–${MAX_KG} kg)`);
          input.focus();
          return;
        }
        if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) {
          toast('Bir tarih seç');
          return;
        }
        if (d !== date && exists) delete store.body[date];
        store.body[d] = Math.round(kg * 10) / 10;
        persistBody();
        closeSheet();
        toast(`${fmt(kg, 1)} kg kaydedildi`);
      };
      sh.querySelector('#bwSave').addEventListener('click', save);
      input.addEventListener('keydown', e => {
        if (e.key === 'Enter') save();
      });
      const del = sh.querySelector('#bwDel');
      if (del)
        del.addEventListener('click', () => {
          delete store.body[date];
          persistBody();
          closeSheet();
          toast('Tartı silindi');
        });
    },
  );
}
