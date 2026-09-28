import { barbellCaption, barbellSVG } from '../components/barbell.js';
import { bestE1, lastTime, session } from '../domain/workout.js';
import { esc, parseDecimal } from '../lib/dom.js';
import { e1rm } from '../lib/fitness.js';
import { fmt } from '../lib/format.js';
import { persistSession } from '../services/persist.js';
import { ui } from '../state/ui.js';
import { closeSheet, openSheet } from '../ui/sheet.js';
import { toast } from '../ui/toast.js';

const REP_CHIPS = [3, 5, 6, 8, 10, 12, 15];

/** Başlangıç değerleri: düzenlenen set > bugünkü son set > önceki antrenmanın ilk seti > varsayılan. */
function initialValues(e, setIdx) {
  if (setIdx !== undefined) return e.sets[setIdx];
  if (e.sets.length) return e.sets[e.sets.length - 1];
  const lt = lastTime(e.name, ui.date);
  if (lt) return lt.sets[0];
  return { kg: e.bar ? 20 : 10, reps: 10 };
}

/** Set ekleme (setIdx yoksa) ya da düzenleme paneli. */
export function openSetSheet(exIdx, setIdx) {
  const e = session(ui.date).exercises[exIdx];
  const editing = setIdx !== undefined;
  const { kg, reps } = initialValues(e, setIdx);
  const step = e.bar ? 2.5 : 1;
  const setNo = editing ? setIdx + 1 : e.sets.length + 1;

  openSheet(
    `
    <h2>${esc(e.name)}</h2><div class="sub">${editing ? `Set ${setNo} düzenleniyor` : `Set ${setNo}`}</div>
    ${e.bar ? `<div class="barbell"><div id="bb">${barbellSVG(kg)}</div><div class="cap" id="bbcap">${esc(barbellCaption(kg))}</div></div>` : ''}
    <div class="field"><label for="kgIn">Ağırlık (kg)${e.bar ? '' : ', vücut ağırlığı için 0'}</label>
      <div class="stepper"><button type="button" data-step="kg" data-d="-${step}" aria-label="${fmt(step)} kilo azalt">−</button>
      <input id="kgIn" class="num" inputmode="decimal" autocomplete="off" value="${fmt(kg)}">
      <button type="button" data-step="kg" data-d="${step}" aria-label="${fmt(step)} kilo artır">+</button></div></div>
    <div class="field"><label for="repIn">Tekrar</label>
      <div class="stepper"><button type="button" data-step="rep" data-d="-1" aria-label="Bir tekrar azalt">−</button>
      <input id="repIn" class="num" inputmode="numeric" autocomplete="off" value="${reps}">
      <button type="button" data-step="rep" data-d="1" aria-label="Bir tekrar artır">+</button></div>
      <div class="chips">${REP_CHIPS.map(r => `<button type="button" class="chip" data-reps="${r}" aria-pressed="${r === reps}">${r}</button>`).join('')}</div></div>
    <div class="sheetactions">
      ${editing ? `<button class="btn danger" id="delSet">Seti sil</button>` : ''}
      <button class="btn primary grow" id="saveSet">${editing ? 'Değişiklikleri kaydet' : 'Seti kaydet'}</button>
    </div>`,
    sh => {
      const kgIn = sh.querySelector('#kgIn');
      const repIn = sh.querySelector('#repIn');
      const readKg = () => {
        const v = parseDecimal(kgIn.value);
        return isNaN(v) ? 0 : Math.max(0, v);
      };
      const readRep = () => {
        const v = parseInt(repIn.value, 10);
        return isNaN(v) ? 0 : Math.max(0, v);
      };
      const update = () => {
        if (e.bar) {
          const k = readKg();
          sh.querySelector('#bb').innerHTML = barbellSVG(k);
          sh.querySelector('#bbcap').textContent = barbellCaption(k);
        }
        const r = readRep();
        sh.querySelectorAll('[data-reps]').forEach(c =>
          c.setAttribute('aria-pressed', String(+c.dataset.reps === r)),
        );
      };
      kgIn.addEventListener('input', update);
      repIn.addEventListener('input', update);
      [kgIn, repIn].forEach(i => i.addEventListener('focus', () => i.select()));
      sh.querySelectorAll('[data-step]').forEach(b =>
        b.addEventListener('click', () => {
          const d = parseFloat(b.dataset.d);
          if (b.dataset.step === 'kg') kgIn.value = fmt(Math.max(0, Math.round((readKg() + d) * 100) / 100));
          else repIn.value = Math.max(1, readRep() + d);
          update();
        }),
      );
      sh.querySelectorAll('[data-reps]').forEach(b =>
        b.addEventListener('click', () => {
          repIn.value = b.dataset.reps;
          update();
        }),
      );

      const save = () => {
        const k = readKg();
        const r = readRep();
        if (r < 1) {
          toast('Tekrar sayısı en az 1 olmalı');
          repIn.focus();
          return;
        }
        const prevBest = bestE1(e.name, editing ? e.sets[setIdx] : null);
        const set = { kg: k, reps: r };
        if (editing) e.sets[setIdx] = set;
        else e.sets.push(set);
        persistSession(ui.date);
        closeSheet();
        const now = e1rm(k, r);
        if (prevBest > 0 && now > prevBest + 0.01) toast(`Yeni rekor! Tahmini 1TM ${fmt(now, 0)} kg`, true);
        else if (!editing) toast(`Set ${setNo} kaydedildi`);
      };
      sh.querySelector('#saveSet').addEventListener('click', save);
      [kgIn, repIn].forEach(i =>
        i.addEventListener('keydown', ev => {
          if (ev.key === 'Enter') save();
        }),
      );

      const del = sh.querySelector('#delSet');
      if (del)
        del.addEventListener('click', () => {
          e.sets.splice(setIdx, 1);
          persistSession(ui.date);
          closeSheet();
          toast('Set silindi');
        });
      setTimeout(() => sh.querySelector('#saveSet').focus({ preventScroll: true }), 50);
    },
  );
}
