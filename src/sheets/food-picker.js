import { defaultMeal, FOOD_CATS, mealName, MY_FOODS_CAT } from '../data/foods.js';
import { allFoods, recentFoods } from '../domain/nutrition.js';
import { $, esc } from '../lib/dom.js';
import { fmt, nameKey } from '../lib/format.js';
import { openSheet } from '../ui/sheet.js';
import { openCustomFood } from './custom-food.js';
import { openAmountSheet } from './food-amount.js';

const ALL = 'Tümü';
let state = { q: '', cat: ALL, meal: 'ogle' };

export function openFoodPicker(meal) {
  state = { q: '', cat: ALL, meal: meal || defaultMeal() };
  const cats = [ALL, MY_FOODS_CAT].concat(FOOD_CATS);
  openSheet(
    `<h2>${mealName(state.meal)} için ekle</h2>
    <input class="search" id="fq" type="search" placeholder="Besin ara, örn. yumurta" autocomplete="off" aria-label="Besin ara">
    <div class="chips" id="fc">${cats.map(c => `<button type="button" class="chip" data-c="${c}" aria-pressed="${c === ALL}">${c}</button>`).join('')}</div>
    <div id="flist"></div>`,
    sh => {
      const q = sh.querySelector('#fq');
      q.addEventListener('input', () => {
        state.q = q.value;
        drawList();
      });
      sh.querySelector('#fc').addEventListener('click', ev => {
        const b = ev.target.closest('[data-c]');
        if (!b) return;
        state.cat = b.dataset.c;
        sh.querySelectorAll('[data-c]').forEach(c =>
          c.setAttribute('aria-pressed', String(c.dataset.c === state.cat)),
        );
        drawList();
      });
      drawList();
    },
  );
}

function drawList() {
  const box = $('#flist');
  if (!box) return;
  const q = nameKey(state.q);
  const all = allFoods();
  const list = all.filter(
    f => (state.cat === ALL || f.cat === state.cat) && (!q || nameKey(f.name).includes(q)),
  );
  const row = f =>
    `<li><button data-food="${esc(f.name)}"><span><span class="pn">${esc(f.name)}</span><br><span class="pg">100 g: ${fmt(f.k, 0)} kcal, ${fmt(f.p, 1)} g protein</span></span><span class="pg">${f.pl && f.pg ? `1 ${esc(f.pl)} ${fmt(f.pg, 0)} g` : ''}</span></button></li>`;

  let html = '';
  if (!q && state.cat === ALL) {
    const recent = recentFoods(6).map(
      it =>
        all.find(f => nameKey(f.name) === nameKey(it.name)) || {
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
  const isNew = q && !all.some(f => nameKey(f.name) === q);
  html += `<button class="btn" id="newfood" style="width:100%;margin-top:12px;border-style:dashed">${isNew ? `“${esc(state.q.trim())}” adında besin oluştur` : 'Listede yok mu? Kendi besinini oluştur'}</button>`;
  html += list.length
    ? `<ul class="pick">${list.map(row).join('')}</ul>`
    : state.cat === MY_FOODS_CAT && !q
      ? `<p style="color:var(--ink-2)">Henüz kendi besinini eklemedin. Paketli ürünlerin etiketindeki değerlerle ekleyebilirsin.</p>`
      : '';
  box.innerHTML = html;

  box.querySelectorAll('[data-food]').forEach(b =>
    b.addEventListener('click', () => {
      const food =
        all.find(x => x.name === b.dataset.food) ||
        allFoods().find(x => nameKey(x.name) === nameKey(b.dataset.food));
      if (food) openAmountSheet(food, state.meal);
    }),
  );
  box.querySelector('#newfood').addEventListener('click', () => openCustomFood(state.q.trim(), state.meal));
}
