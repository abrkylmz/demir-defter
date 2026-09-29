import { defaultMeal, FOOD_CATS, mealName, MY_FOODS_CAT } from '../data/foods.ts';
import { allFoods, recentFoods } from '../domain/nutrition.ts';
import { closest, data, esc, q, qa } from '../lib/dom.ts';
import type { Food, MealKey } from '../types.ts';
import { fmt, nameKey } from '../lib/format.ts';
import { openSheet } from '../ui/sheet.ts';
import { openCustomFood } from './custom-food.ts';
import { openAmountSheet } from './food-amount.ts';

const ALL = 'Tümü';
let state: { q: string; cat: string; meal: MealKey } = { q: '', cat: ALL, meal: 'ogle' };

export function openFoodPicker(meal?: MealKey): void {
  state = { q: '', cat: ALL, meal: meal || defaultMeal() };
  const cats = [ALL, MY_FOODS_CAT].concat(FOOD_CATS);
  openSheet(
    `<h2>${mealName(state.meal)} için ekle</h2>
    <input class="search" id="fq" type="search" placeholder="Besin ara, örn. yumurta" autocomplete="off" aria-label="Besin ara">
    <div class="chips" id="fc">${cats.map(c => `<button type="button" class="chip" data-c="${c}" aria-pressed="${c === ALL}">${c}</button>`).join('')}</div>
    <div id="flist"></div>`,
    sh => {
      const search = q<HTMLInputElement>(sh, '#fq');
      search.addEventListener('input', () => {
        state.q = search.value;
        drawList();
      });
      q(sh, '#fc').addEventListener('click', ev => {
        const b = closest(ev.target, '[data-c]');
        if (!b) return;
        state.cat = data(b, 'c');
        qa(sh, '[data-c]').forEach(c => c.setAttribute('aria-pressed', String(c.dataset.c === state.cat)));
        drawList();
      });
      drawList();
    },
  );
}

function drawList() {
  const box = document.getElementById('flist');
  if (!box) return;
  const query = nameKey(state.q);
  const all = allFoods();
  const list = all.filter(
    f => (state.cat === ALL || f.cat === state.cat) && (!query || nameKey(f.name).includes(query)),
  );
  const row = (f: Food) =>
    `<li><button data-food="${esc(f.name)}"><span><span class="pn">${esc(f.name)}</span><br><span class="pg">100 g: ${fmt(f.k, 0)} kcal, ${fmt(f.p, 1)} g protein</span></span><span class="pg">${f.pl && f.pg ? `1 ${esc(f.pl)} ${fmt(f.pg, 0)} g` : ''}</span></button></li>`;

  let html = '';
  if (!query && state.cat === ALL) {
    const recent = recentFoods(6).map(
      (it): Food =>
        all.find(f => nameKey(f.name) === nameKey(it.name)) || {
          cat: '',
          name: it.name,
          k: it.per.k,
          p: it.per.p,
          c: it.per.c,
          f: it.per.f,
          pl: it.pl,
          pg: it.pg,
        },
    );
    if (recent.length)
      html += `<div class="pickhead">Son eklediklerin</div><ul class="pick">${recent.map(row).join('')}</ul><div class="pickhead">Tüm besinler</div>`;
  }
  const isNew = query && !all.some(f => nameKey(f.name) === query);
  html += `<button class="btn" id="newfood" style="width:100%;margin-top:12px;border-style:dashed">${isNew ? `“${esc(state.q.trim())}” adında besin oluştur` : 'Listede yok mu? Kendi besinini oluştur'}</button>`;
  html += list.length
    ? `<ul class="pick">${list.map(row).join('')}</ul>`
    : state.cat === MY_FOODS_CAT && !query
      ? `<p style="color:var(--ink-2)">Henüz kendi besinini eklemedin. Paketli ürünlerin etiketindeki değerlerle ekleyebilirsin.</p>`
      : '';
  box.innerHTML = html;

  qa(box, '[data-food]').forEach(b =>
    b.addEventListener('click', () => {
      const food =
        all.find(x => x.name === data(b, 'food')) ||
        allFoods().find(x => nameKey(x.name) === nameKey(data(b, 'food')));
      if (food) openAmountSheet(food, state.meal);
    }),
  );
  q(box, '#newfood').addEventListener('click', () => openCustomFood(state.q.trim(), state.meal));
}
