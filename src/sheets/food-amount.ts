import { MEALS } from '../data/foods.ts';
import { foodDay, itemVals } from '../domain/nutrition.ts';
import { data, esc, parseDecimal, q, qa } from '../lib/dom.ts';
import { fmt, uid8 } from '../lib/format.ts';
import { persistFood } from '../services/persist.ts';
import { ui } from '../state/ui.ts';
import type { Food, FoodItem, Macros, MealKey } from '../types.ts';
import { closeSheet, openSheet } from '../ui/sheet.ts';
import { toast } from '../ui/toast.ts';

const toPer = (f: Food): { per: Macros } => ({ per: { k: f.k, p: f.p, c: f.c, f: f.f } });

/** Porsiyon katları ve sık kullanılan gramajlar. */
function amountChips(pl: string, pg: number): [number, string][] {
  const chips: [number, string][] = [];
  if (pl && pg) [1, 2, 3].forEach(n => chips.push([n * pg, `${n} ${pl}`]));
  [50, 100, 150, 200].forEach(x => {
    if (!chips.some(c => c[0] === x)) chips.push([x, x + ' g']);
  });
  return chips;
}

/**
 * Miktar ve öğün seçimi. Yeni kayıt için `food` verilir, düzenleme için `idx` (günün items dizisindeki sıra).
 */
export function openAmountSheet(food: Food | null, meal: MealKey, idx?: number): void {
  const day = foodDay(ui.date, true);
  const editing = idx !== undefined;
  const src: Pick<FoodItem, 'per' | 'pl' | 'pg' | 'name' | 'g' | 'meal'> =
    idx !== undefined
      ? day.items[idx]
      : { ...toPer(food!), pl: food!.pl, pg: food!.pg, name: food!.name, g: food!.pg || 100, meal };
  const { per, pl, pg, name } = src;
  const grams = src.g;
  let selectedMeal = src.meal;

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
      const input = q<HTMLInputElement>(sh, '#gIn');
      const read = () => {
        const x = parseDecimal(input.value);
        return isNaN(x) ? 0 : Math.max(0, x);
      };
      const update = () => {
        const r = read() / 100;
        q(sh, '#prev').innerHTML =
          `<div><b class="num">${fmt(per.k * r, 0)}</b><span>kcal</span></div><div><b class="num">${fmt(per.p * r, 1)}</b><span>protein g</span></div><div><b class="num">${fmt(per.c * r, 1)}</b><span>karb. g</span></div><div><b class="num">${fmt(per.f * r, 1)}</b><span>yağ g</span></div>`;
        qa(sh, '[data-g]').forEach(c =>
          c.setAttribute('aria-pressed', String(Math.abs(Number(data(c, 'g')) - read()) < 0.01)),
        );
      };
      input.addEventListener('input', update);
      input.addEventListener('focus', () => input.select());
      qa(sh, '[data-gd]').forEach(b =>
        b.addEventListener('click', () => {
          input.value = fmt(Math.max(0, read() + Number(data(b, 'gd'))), 0);
          update();
        }),
      );
      qa(sh, '[data-g]').forEach(b =>
        b.addEventListener('click', () => {
          input.value = fmt(Number(data(b, 'g')), 0);
          update();
        }),
      );
      qa(sh, '[data-m]').forEach(b =>
        b.addEventListener('click', () => {
          selectedMeal = data(b, 'm') as MealKey;
          qa(sh, '[data-m]').forEach(c =>
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
        const item: FoodItem = {
          id: idx !== undefined ? d.items[idx].id : uid8(),
          name,
          meal: selectedMeal,
          g: Math.round(g * 10) / 10,
          per,
          pl: pl || '',
          pg: pg || 0,
        };
        if (idx !== undefined) d.items[idx] = item;
        else d.items.push(item);
        persistFood(ui.date);
        closeSheet();
        toast(editing ? 'Güncellendi' : `${name} eklendi, ${fmt(itemVals(item).k, 0)} kcal`);
      };
      q(sh, '#fSave').addEventListener('click', save);
      input.addEventListener('keydown', e => {
        if (e.key === 'Enter') save();
      });
      const del = sh.querySelector<HTMLElement>('#fDel');
      if (del)
        del.addEventListener('click', () => {
          foodDay(ui.date, true).items.splice(idx!, 1);
          persistFood(ui.date);
          closeSheet();
          toast('Silindi');
        });
      update();
    },
  );
}
