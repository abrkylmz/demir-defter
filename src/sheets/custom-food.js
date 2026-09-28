import { MY_FOODS_CAT } from '../data/foods.js';
import { esc, parseDecimal } from '../lib/dom.js';
import { fmt, nameKey } from '../lib/format.js';
import { persistNut } from '../services/persist.js';
import { store } from '../state/store.js';
import { openSheet } from '../ui/sheet.js';
import { toast } from '../ui/toast.js';
import { openAmountSheet } from './food-amount.js';

const kcalFromMacros = (p, c, f) => p * 4 + c * 4 + f * 9;

/** Kullanıcının kendi besinini (100 g değerleriyle) oluşturur, ardından miktar paneline geçer. */
export function openCustomFood(name, meal) {
  openSheet(
    `<h2>Yeni besin</h2><div class="sub">Değerleri 100 g için gir. Sadece kaloriyi biliyorsan diğerlerini boş bırakabilirsin.</div>
    <div class="field"><label for="cfN">Ad</label><input id="cfN" class="date" value="${esc(name || '')}" maxlength="60" autocomplete="off"></div>
    <div class="grid2">
      <div class="field"><label for="cfK">Kalori (kcal)</label><input id="cfK" class="date num2" inputmode="decimal"></div>
      <div class="field"><label for="cfP">Protein (g)</label><input id="cfP" class="date num2" inputmode="decimal"></div>
      <div class="field"><label for="cfC">Karbonhidrat (g)</label><input id="cfC" class="date num2" inputmode="decimal"></div>
      <div class="field"><label for="cfF">Yağ (g)</label><input id="cfF" class="date num2" inputmode="decimal"></div>
      <div class="field"><label for="cfPl">Porsiyon adı (isteğe bağlı)</label><input id="cfPl" class="date" placeholder="örn. paket, adet" maxlength="20"></div>
      <div class="field"><label for="cfPg">1 porsiyon kaç g</label><input id="cfPg" class="date num2" inputmode="decimal"></div>
    </div>
    <p class="hint" id="cfHint"></p>
    <div class="sheetactions"><button class="btn primary grow" id="cfSave">Kaydet ve ekle</button></div>`,
    sh => {
      const num = id => parseDecimal(sh.querySelector(id).value);
      const hint = () => {
        const p = num('#cfP');
        const c = num('#cfC');
        const f = num('#cfF');
        if ([p, c, f].every(x => !isNaN(x)))
          sh.querySelector('#cfHint').textContent =
            `Makrolara göre yaklaşık ${fmt(kcalFromMacros(p, c, f), 0)} kcal ediyor. Kaloriyi boş bırakırsan bu değer kullanılır.`;
      };
      ['#cfP', '#cfC', '#cfF'].forEach(i => sh.querySelector(i).addEventListener('input', hint));

      sh.querySelector('#cfSave').addEventListener('click', () => {
        const n = sh.querySelector('#cfN').value.trim();
        if (!n) {
          toast('Besine bir ad ver');
          return;
        }
        let p = num('#cfP');
        let c = num('#cfC');
        let f = num('#cfF');
        let k = num('#cfK');
        if (isNaN(k) && [p, c, f].every(isNaN)) {
          toast('En azından kaloriyi gir');
          sh.querySelector('#cfK').focus();
          return;
        }
        p = isNaN(p) ? 0 : Math.max(0, p);
        c = isNaN(c) ? 0 : Math.max(0, c);
        f = isNaN(f) ? 0 : Math.max(0, f);
        if (isNaN(k)) k = kcalFromMacros(p, c, f);
        k = Math.max(0, k);
        const pg = num('#cfPg');
        const pl = sh.querySelector('#cfPl').value.trim();
        const hasPortion = pl && pg > 0;
        const food = { name: n, k, p, c, f, pl: hasPortion ? pl : '', pg: hasPortion ? pg : 0 };
        store.foodCustom = store.foodCustom.filter(x => nameKey(x.name) !== nameKey(n)).concat([food]);
        persistNut();
        openAmountSheet(Object.assign({ cat: MY_FOODS_CAT }, food), meal);
      });
    },
  );
}
