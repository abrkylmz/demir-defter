// Fotoğraftan kalori: fotoğraf çek/seç → sunucuda tahmin → kalemleri gözden geçir, gramajı düzelt → öğüne ekle.
// Tahminler kesin değildir; kullanıcı her kalemi onaylar ya da çıkarır.
import { mealName, MEALS } from '../data/foods.ts';
import { allFoods, foodDay } from '../domain/nutrition.ts';
import { closest, data, esc, parseDecimal, q, qa } from '../lib/dom.ts';
import { fmt, nameKey, uid8 } from '../lib/format.ts';
import { prepareImage, type PreparedImage } from '../lib/image.ts';
import { analyzeFoodPhoto, authErrorText, type FoodEstimate, type FoodPhotoResult } from '../services/api.ts';
import { persistFood } from '../services/persist.ts';
import { ui } from '../state/ui.ts';
import type { Food, FoodItem, Macros, MealKey } from '../types.ts';
import { camera } from '../ui/icons.ts';
import { closeSheet, openSheet } from '../ui/sheet.ts';
import { toast } from '../ui/toast.ts';

interface Row {
  est: FoodEstimate;
  /** Eşleşen tablo besini; değerler ondan alınır */
  food: Food | null;
  grams: number;
  on: boolean;
}

let meal: MealKey = 'ogle';
let image: PreparedImage | null = null;

const per100 = (r: Row): Macros =>
  r.food ? { k: r.food.k, p: r.food.p, c: r.food.c, f: r.food.f } : r.est.per;
const kcalOf = (r: Row) => (per100(r).k * r.grams) / 100;

/** Dosya seçiciyi açar (telefonda kamera ya da galeri). Kullanıcı hareketinin içinde çağrılmalı. */
export function openFoodPhoto(forMeal: MealKey): void {
  meal = forMeal;
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/*';
  input.addEventListener('change', () => {
    const file = input.files?.[0];
    if (file) void analyze(file);
  });
  input.click();
}

function releaseImage(): void {
  if (image) URL.revokeObjectURL(image.previewUrl);
  image = null;
}

const preview = () =>
  image ? `<img class="photo-preview" src="${image.previewUrl}" alt="Çektiğin öğün fotoğrafı">` : '';

function showStatus(title: string, body: string, retry = false): void {
  openSheet(
    `<h2>${esc(title)}</h2>${preview()}<div class="photo-status" role="status">${body}</div>
    ${retry ? `<div class="sheetactions"><button class="btn" id="phManual">Elle ekle</button><button class="btn primary grow" id="phRetry">${camera}Başka fotoğraf</button></div>` : ''}`,
    sh => {
      sh.querySelector('#phRetry')?.addEventListener('click', () => openFoodPhoto(meal));
      sh.querySelector('#phManual')?.addEventListener('click', () => closeSheet());
    },
  );
}

async function analyze(file: File): Promise<void> {
  releaseImage();
  try {
    image = await prepareImage(file);
  } catch {
    showStatus('Fotoğraf okunamadı', '<p>Bu dosya açılamadı. Farklı bir fotoğraf dene.</p>', true);
    return;
  }
  showStatus(
    'Analiz ediliyor…',
    '<p><span class="spinner" aria-hidden="true"></span>Tabağındaki yiyecekleri ve miktarları tahmin ediyorum. Bu birkaç saniye sürebilir.</p><p class="hint">Fotoğraf yalnızca bu tahmin için yapay zekâya gönderilir, saklanmaz.</p>',
  );
  const known = allFoods().map(f => f.name);
  let result: FoodPhotoResult;
  try {
    result = await analyzeFoodPhoto(image.base64, image.mediaType, known);
  } catch (e) {
    showStatus('Analiz edilemedi', `<p>${esc(authErrorText(e))}</p>`, true);
    return;
  }
  // Kullanıcı bu arada paneli kapattıysa sonucu gösterme
  if (!ui.sheetOpen) return releaseImage();
  if (!result.isFood) {
    showStatus(
      'Yiyecek bulunamadı',
      '<p>Bu fotoğrafta yiyecek göremedim. Tabağın tamamı görünecek şekilde tekrar dene.</p>',
      true,
    );
    return;
  }
  const foods = allFoods();
  const rows: Row[] = result.items.map(est => ({
    est,
    food: est.match ? foods.find(f => nameKey(f.name) === nameKey(est.match!)) || null : null,
    grams: est.grams,
    on: true,
  }));
  showReview(rows, result);
}

function showReview(rows: Row[], result: FoodPhotoResult): void {
  const rowHtml = (r: Row, i: number) => {
    const name = r.food ? r.food.name : r.est.name;
    const badge = r.food
      ? '<span class="ph-badge">tablodan</span>'
      : r.est.confidence === 'low'
        ? '<span class="ph-badge warn">emin değil</span>'
        : '';
    return `<li class="ph-row${r.on ? '' : ' off'}" data-i="${i}">
      <label class="ph-check"><input type="checkbox" data-on="${i}" ${r.on ? 'checked' : ''} aria-label="${esc(name)} ekle"></label>
      <span class="ph-name"><b>${esc(name)}</b>${badge}<span class="ph-kcal" id="phK${i}">${fmt(kcalOf(r), 0)} kcal</span></span>
      <span class="ph-grams"><input class="num" inputmode="numeric" data-g="${i}" value="${r.grams}" aria-label="${esc(name)} gram"><small>g</small></span>
    </li>`;
  };

  openSheet(
    `<h2>Fotoğraftan ekle</h2>
    ${preview()}
    <p class="hint">Değerler tahminidir. Gramajları kontrol et, olmayanların işaretini kaldır.${result.note ? ' ' + esc(result.note) : ''}</p>
    <ul class="ph-list" id="phList">${rows.map(rowHtml).join('')}</ul>
    <div class="ph-total" id="phTotal"></div>
    <div class="field"><label>Öğün</label><div class="chips" id="phMeal">${MEALS.map(([k, l]) => `<button type="button" class="chip" data-m="${k}" aria-pressed="${k === meal}">${l}</button>`).join('')}</div></div>
    <div class="sheetactions">
      <button class="btn" id="phRetry" aria-label="Başka fotoğraf çek">${camera}</button>
      <button class="btn primary grow" id="phAdd"></button>
    </div>
    <p class="hint" style="text-align:center">Bugün ${result.remaining} fotoğraf analizi hakkın kaldı.</p>`,
    sh => {
      const update = () => {
        const on = rows.filter(r => r.on);
        const t = on.reduce(
          (a, r) => {
            const p = per100(r);
            const m = r.grams / 100;
            return { k: a.k + p.k * m, p: a.p + p.p * m, c: a.c + p.c * m, f: a.f + p.f * m };
          },
          { k: 0, p: 0, c: 0, f: 0 },
        );
        q(sh, '#phTotal').innerHTML =
          `<b class="num">${fmt(t.k, 0)}</b> kcal · P ${fmt(t.p, 0)} g · K ${fmt(t.c, 0)} g · Y ${fmt(t.f, 0)} g`;
        const add = q<HTMLButtonElement>(sh, '#phAdd');
        add.disabled = !on.length;
        add.textContent = on.length ? `${mealName(meal)} için ${on.length} kalem ekle` : 'Kalem seç';
        rows.forEach((r, i) => {
          q(sh, `#phK${i}`).textContent = `${fmt(kcalOf(r), 0)} kcal`;
          q(sh, `[data-i="${i}"]`).classList.toggle('off', !r.on);
        });
      };

      const list = q(sh, '#phList');
      list.addEventListener('change', ev => {
        const cb = closest<HTMLInputElement>(ev.target, '[data-on]');
        if (cb) rows[Number(data(cb, 'on'))].on = cb.checked;
        update();
      });
      list.addEventListener('input', ev => {
        const g = closest<HTMLInputElement>(ev.target, '[data-g]');
        if (!g) return;
        const v = parseDecimal(g.value);
        rows[Number(data(g, 'g'))].grams = Number.isFinite(v) ? Math.max(0, Math.min(3000, v)) : 0;
        update();
      });
      qa(list, '[data-g]').forEach(i => i.addEventListener('focus', () => (i as HTMLInputElement).select()));

      q(sh, '#phMeal').addEventListener('click', ev => {
        const b = closest(ev.target, '[data-m]');
        if (!b) return;
        meal = data(b, 'm') as MealKey;
        qa(sh, '[data-m]').forEach(c => c.setAttribute('aria-pressed', String(c === b)));
        update();
      });

      q(sh, '#phRetry').addEventListener('click', () => openFoodPhoto(meal));

      q(sh, '#phAdd').addEventListener('click', () => {
        const chosen = rows.filter(r => r.on && r.grams > 0);
        if (!chosen.length) return;
        const day = foodDay(ui.date, true);
        const items: FoodItem[] = chosen.map(r => ({
          id: uid8(),
          name: r.food ? r.food.name : r.est.name,
          meal,
          g: Math.round(r.grams),
          per: per100(r),
          pl: r.food?.pl || '',
          pg: r.food?.pg || 0,
        }));
        day.items.push(...items);
        persistFood(ui.date);
        const kcal = chosen.reduce((a, r) => a + kcalOf(r), 0);
        releaseImage();
        closeSheet();
        toast(`${items.length} besin eklendi, ${fmt(kcal, 0)} kcal`);
      });

      update();
    },
  );
}
