import { MEALS } from '../data/foods.js';
import { foodDay, itemVals } from '../domain/nutrition.js';
import { esc, parseDecimal } from '../lib/dom.js';
import { fmt, uid8 } from '../lib/format.js';
import { persistFood } from '../services/persist.js';
import { ui } from '../state/ui.js';
import { closeSheet, openSheet } from '../ui/sheet.js';
import { toast } from '../ui/toast.js';

/** Porsiyon katları ve sık kullanılan gramajlar. */
function amountChips(pl, pg) {
  const chips = [];
  if (pl && pg) [1, 2, 3].forEach(n => chips.push([n * pg, `${n} ${pl}`]));
  [50, 100, 150, 200].forEach(x => {
    if (!chips.some(c => c[0] === x)) chips.push([x, x + ' g']);
  });
  return chips;
}

/**
 * Miktar ve öğün seçimi. Yeni kayıt için `food` verilir, düzenleme için `idx` (günün items dizisindeki sıra).
 */
export function openAmountSheet(food, meal, idx) {
  const day = foodDay(ui.date, true);
  const editing = idx !== undefined;
  const src = editing ? day.items[idx] : null;
  const per = editing ? src.per : { k: food.k, p: food.p, c: food.c, f: food.f };
  const pl = editing ? src.pl : food.pl;
  const pg = editing ? src.pg : food.pg;
  const name = editing ? src.name : food.name;
  const grams = editing ? src.g : pg || 100;
  let selectedMeal = editing ? src.meal : meal;

  openSheet(
    `<h2>${esc(name)}</h2><div class="sub">100 g: ${fmt(per.k, 0)} kcal, P ${fmt(per.p, 1)} g, K ${fmt(per.c, 1)} g, Y ${fmt(per.f, 1)} g</div>
    <div class="field"><label for="gIn">Miktar (gram)</label>
      <div class="stepper"><button type="button" data-gd="-10" aria-label="10 gram azalt">−</button>
      <input id="gIn" class="num" inputmode="decimal" autocomplete="off" value="${fmt(grams, 0)}">
      <button type="button" data-gd="10" aria-label="10 gram artır">+</button></div>
      <div class="chips" id="gchips">${amountChips(pl, pg)
        .map(c => `<button type="button" class="chip" data-g="${c[0]}">${esc(c[1])}</button>`)
        .join('')}</div></div>
    <div class="preview" id="prev"></div>
    <div class="field"><label>Öğün</label><div class="chips" id="mchips">${MEALS.map(([k, l]) => `<button type="button" class="chip" data-m="${k}" aria-pressed="${k === selectedMeal}">${l}</button>`).join('')}</div></div>
    <div class="sheetactions">${editing ? '<button class="btn danger" id="fDel">Sil</button>' : ''}<button class="btn primary grow" id="fSave">${editing ? 'Kaydet' : 'Ekle'}</button></div>`,
    sh => {
      const input = sh.querySelector('#gIn');
      const read = () => {
        const x = parseDecimal(input.value);
        return isNaN(x) ? 0 : Math.max(0, x);
      };
      const update = () => {
        const r = read() / 100;
        sh.querySelector('#prev').innerHTML =
          `<div><b class="num">${fmt(per.k * r, 0)}</b><span>kcal</span></div><div><b class="num">${fmt(per.p * r, 1)}</b><span>protein g</span></div><div><b class="num">${fmt(per.c * r, 1)}</b><span>karb. g</span></div><div><b class="num">${fmt(per.f * r, 1)}</b><span>yağ g</span></div>`;
        sh.querySelectorAll('[data-g]').forEach(c =>
          c.setAttribute('aria-pressed', String(Math.abs(+c.dataset.g - read()) < 0.01)),
        );
      };
      input.addEventListener('input', update);
      input.addEventListener('focus', () => input.select());
      sh.querySelectorAll('[data-gd]').forEach(b =>
        b.addEventListener('click', () => {
          input.value = fmt(Math.max(0, read() + +b.dataset.gd), 0);
          update();
        }),
      );
      sh.querySelectorAll('[data-g]').forEach(b =>
        b.addEventListener('click', () => {
          input.value = fmt(+b.dataset.g, 0);
          update();
        }),
      );
      sh.querySelectorAll('[data-m]').forEach(b =>
        b.addEventListener('click', () => {
          selectedMeal = b.dataset.m;
          sh.querySelectorAll('[data-m]').forEach(c =>
            c.setAttribute('aria-pressed', String(c.dataset.m === selectedMeal)),
          );
        }),
      );

      const save = () => {
        const g = read();
        if (!(g > 0)) {
          toast('Miktarı gram olarak gir');
          input.focus();
          return;
        }
        const d = foodDay(ui.date, true);
        const item = {
          id: editing ? d.items[idx].id : uid8(),
          name,
          meal: selectedMeal,
          g: Math.round(g * 10) / 10,
          per,
          pl: pl || '',
          pg: pg || 0,
        };
        if (editing) d.items[idx] = item;
        else d.items.push(item);
        persistFood(ui.date);
        closeSheet();
        toast(editing ? 'Güncellendi' : `${name} eklendi, ${fmt(itemVals(item).k, 0)} kcal`);
      };
      sh.querySelector('#fSave').addEventListener('click', save);
      input.addEventListener('keydown', e => {
        if (e.key === 'Enter') save();
      });
      const del = sh.querySelector('#fDel');
      if (del)
        del.addEventListener('click', () => {
          foodDay(ui.date).items.splice(idx, 1);
          persistFood(ui.date);
          closeSheet();
          toast('Silindi');
        });
      update();
    },
  );
}
