import { latestWeight } from '../domain/body.js';
import { parseDecimal } from '../lib/dom.js';
import { ACTIVITY, calcTargets } from '../lib/fitness.js';
import { fmt } from '../lib/format.js';
import { persistNut } from '../services/persist.js';
import { store } from '../state/store.js';
import { closeSheet, openSheet } from '../ui/sheet.js';
import { toast } from '../ui/toast.js';

const chipset = (name, options, value) =>
  `<div class="chips" data-set="${name}">${options.map(([v, l]) => `<button type="button" class="chip" data-v="${v}" aria-pressed="${v === value}">${l}</button>`).join('')}</div>`;

const GOAL_TEXT = {
  cut: 'Yağ yakmak için bunun %15 altı,',
  bulk: 'Kas kazanmak için bunun %10 üstü,',
  keep: 'Korumak için aynı seviye,',
};

/** Günlük kalori / makro / su hedefleri. "Hesapla" Mifflin-St Jeor ile doldurur, kullanıcı değiştirebilir. */
export function openGoals() {
  const g = store.goals || {};
  const pr = g.profile || {};
  const w = pr.weight || latestWeight() || '';
  const st = { sex: pr.sex || 'e', act: pr.act || ACTIVITY.moderate, goal: pr.goal || 'keep' };

  openSheet(
    `<h2>Günlük hedeflerim</h2><div class="sub">Bilgilerini gir, hedefleri hesaplayayım. Sonra istediğin gibi değiştirebilirsin.</div>
    <div class="field"><label>Cinsiyet</label>${chipset(
      'sex',
      [
        ['e', 'Erkek'],
        ['k', 'Kadın'],
      ],
      st.sex,
    )}</div>
    <div class="grid3">
      <div class="field"><label for="gA">Yaş</label><input id="gA" class="date num2" inputmode="numeric" value="${pr.age || ''}"></div>
      <div class="field"><label for="gH">Boy (cm)</label><input id="gH" class="date num2" inputmode="numeric" value="${pr.height || ''}"></div>
      <div class="field"><label for="gW">Kilo (kg)</label><input id="gW" class="date num2" inputmode="decimal" value="${w ? fmt(w, 1) : ''}"></div>
    </div>
    <div class="field"><label>Haftada kaç gün antrenman?</label>${chipset(
      'act',
      [
        [ACTIVITY.light, '1–3 gün'],
        [ACTIVITY.moderate, '3–5 gün'],
        [ACTIVITY.high, '6–7 gün'],
      ],
      st.act,
    )}</div>
    <div class="field"><label>Hedefin</label>${chipset(
      'goal',
      [
        ['cut', 'Yağ yakmak'],
        ['keep', 'Kilomu korumak'],
        ['bulk', 'Kas kazanmak'],
      ],
      st.goal,
    )}</div>
    <button class="btn" id="gCalc" style="width:100%">Hesapla</button>
    <p class="hint" id="gInfo"></p>
    <div class="grid2" style="margin-top:4px">
      <div class="field"><label for="gK">Kalori (kcal)</label><input id="gK" class="date num2" inputmode="numeric" value="${g.kcal || ''}"></div>
      <div class="field"><label for="gP">Protein (g)</label><input id="gP" class="date num2" inputmode="numeric" value="${g.p || ''}"></div>
      <div class="field"><label for="gC">Karbonhidrat (g)</label><input id="gC" class="date num2" inputmode="numeric" value="${g.c || ''}"></div>
      <div class="field"><label for="gF">Yağ (g)</label><input id="gF" class="date num2" inputmode="numeric" value="${g.f || ''}"></div>
      <div class="field"><label for="gWa">Su (bardak, 250 ml)</label><input id="gWa" class="date num2" inputmode="numeric" value="${g.water || ''}"></div>
    </div>
    <div class="sheetactions"><button class="btn primary grow" id="gSave">Kaydet</button></div>`,
    sh => {
      sh.querySelectorAll('[data-set]').forEach(set =>
        set.addEventListener('click', ev => {
          const b = ev.target.closest('[data-v]');
          if (!b) return;
          st[set.dataset.set] = b.dataset.v;
          set.querySelectorAll('[data-v]').forEach(c => c.setAttribute('aria-pressed', String(c === b)));
        }),
      );
      const num = id => parseDecimal(sh.querySelector(id).value);
      const setVal = (id, v) => (sh.querySelector(id).value = v);

      sh.querySelector('#gCalc').addEventListener('click', () => {
        const age = num('#gA');
        const height = num('#gH');
        const weight = num('#gW');
        if (
          !(age >= 14 && age <= 90) ||
          !(height >= 120 && height <= 230) ||
          !(weight >= 30 && weight <= 300)
        ) {
          toast('Yaş, boy ve kiloyu kontrol et');
          return;
        }
        const r = calcTargets({ sex: st.sex, age, height, weight, act: st.act, goal: st.goal });
        setVal('#gK', r.kcal);
        setVal('#gP', r.p);
        setVal('#gC', r.c);
        setVal('#gF', r.f);
        setVal('#gWa', r.water);
        sh.querySelector('#gInfo').textContent =
          `Günlük harcaman yaklaşık ${fmt(Math.round(r.tdee / 10) * 10, 0)} kcal. ${GOAL_TEXT[st.goal]} protein kilogram başına ${st.goal === 'cut' ? '2' : '1,8'} g, yağ kalorinin %25'i olarak hesaplandı.`;
      });

      sh.querySelector('#gSave').addEventListener('click', () => {
        const k = num('#gK');
        if (!(k >= 800 && k <= 6000)) {
          toast('Kalori hedefini gir ya da Hesapla’ya dokun');
          return;
        }
        store.goals = {
          kcal: Math.round(k),
          p: Math.round(num('#gP') || 0),
          c: Math.round(num('#gC') || 0),
          f: Math.round(num('#gF') || 0),
          water: Math.round(num('#gWa') || 10),
          profile: {
            sex: st.sex,
            age: num('#gA') || '',
            height: num('#gH') || '',
            weight: num('#gW') || '',
            act: st.act,
            goal: st.goal,
          },
        };
        persistNut();
        closeSheet();
        toast('Hedeflerin kaydedildi');
      });
    },
  );
}
