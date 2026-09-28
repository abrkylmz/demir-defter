import { weekHead } from '../components/week-nav.ts';
import { OTHER_GROUP } from '../data/exercises.ts';
import { suggestFor } from '../domain/suggest.ts';
import { bestE1, exerciseHistory, lastTime } from '../domain/workout.ts';
import {
  addDays,
  DAY_NAMES,
  longDate,
  parseYmd,
  relativeDayTitle,
  shortDate,
  todayStr,
  weekdayLong,
} from '../lib/date.ts';
import { esc } from '../lib/dom.ts';
import { e1rm } from '../lib/fitness.ts';
import { fmt } from '../lib/format.ts';
import { store } from '../state/store.ts';
import { ui } from '../state/ui.ts';
import { chevronToggle, dots, plus, plusLarge } from '../ui/icons.ts';
import type { Exercise } from '../types.ts';

function weekStrip(): string {
  const t = todayStr();
  let out = '';
  for (let i = 0; i < 7; i++) {
    const d = addDays(ui.weekStart, i);
    const s = store.sessions[d];
    const n = s ? s.exercises.filter(e => e.sets.length).length : 0;
    const marks = n ? '<i></i>'.repeat(Math.min(n, 3)) : '';
    out += `<button class="day${d === t ? ' today' : ''}${d === ui.date ? ' sel' : ''}" data-date="${d}" aria-label="${esc(longDate(d))}${n ? `, ${n} hareket` : ''}" aria-pressed="${d === ui.date}">
      <span class="dn">${DAY_NAMES[i]}</span><span class="dd">${parseYmd(d).getDate()}</span><span class="dots">${marks}</span></button>`;
  }
  return `<div class="week">${out}</div>`;
}

function bodyWeightLine(): string {
  if (ui.date > todayStr()) return '';
  const w = store.body[ui.date];
  return w !== undefined
    ? `<button class="bwline" data-act="bw" data-date="${ui.date}"><span class="l">Vücut ağırlığı</span><span class="v">${fmt(w, 1)} kg</span></button>`
    : `<button class="bwline" data-act="bw" data-date="${ui.date}"><span class="l">Vücut ağırlığı</span><span class="add">Tartıldın mı? Ekle</span></button>`;
}

const EMPTY_BAR =
  '<svg width="120" height="46" viewBox="0 0 120 46" aria-hidden="true"><rect x="4" y="21" width="112" height="4" rx="2" fill="var(--bar)"/><rect x="20" y="4" width="8" height="38" rx="2" fill="var(--line)"/><rect x="92" y="4" width="8" height="38" rx="2" fill="var(--line)"/></svg>';

export function renderLog(): string {
  const t = todayStr();
  const s = store.sessions[ui.date];
  const ex = s ? s.exercises : [];
  const recent = ui.date === t || ui.date === addDays(t, -1);
  const sub = recent ? longDate(ui.date) : weekdayLong(ui.date);
  const note = s && s.note;

  const body = ex.length
    ? ex.map((e, i) => renderExercise(e, i)).join('')
    : `<div class="empty">${EMPTY_BAR}
      <p>${ui.date > t ? 'Bu gün henüz gelmedi ama planını şimdiden yazabilirsin.' : 'Bu güne ait kayıt yok. İlk hareketini ekle ya da bir şablondan başla.'}</p></div>`;

  return `${weekHead()}${weekStrip()}
  <div class="dayline"><h1>${esc(relativeDayTitle(ui.date))}</h1><p>${esc(sub)}</p></div>
  ${bodyWeightLine()}
  ${note ? `<button class="noteline" data-act="daynote" aria-label="Günün notunu düzenle"><span class="l">Not</span><span class="t">${esc(note)}</span></button>` : ''}
  ${body}
  <button class="addex" data-act="pick">${plusLarge}Hareket ekle</button>
  <div class="logtools">
    <button class="btn grow" data-act="templates">Şablondan ekle</button>
    ${ex.length ? '<button class="btn grow" data-act="savetpl">Şablon kaydet</button>' : ''}
    ${note ? '' : '<button class="btn grow" data-act="daynote">Not ekle</button>'}
  </div>`;
}

/** Günün ilk setinden önce kartta gösterilen hedef. */
function suggestionLine(e: Exercise): string {
  const s = suggestFor(e.name, e.bar, ui.date);
  if (!s) return '';
  const target = s.kg > 0 ? `${fmt(s.kg)} kg × ${s.reps}` : `${s.reps} tekrar`;
  return `<div class="suggest"><span class="suggest-tag">Bugünkü hedef</span><b class="num">${target}</b><span class="suggest-why">${esc(s.reason)}</span></div>`;
}

function renderExercise(e: Exercise, i: number): string {
  const open = ui.open.has(e.id);
  const head = `<div class="exhead"><button class="extoggle" data-act="toggle" data-id="${e.id}" aria-expanded="${open}">
      ${chevronToggle}
      <span><h3>${esc(e.name)}</h3>${open ? `<div class="grp">${esc(e.group || OTHER_GROUP)}${e.bar ? ', barbell' : ''}</div>` : ''}</span>
      ${open ? `<span class="cnt">${e.sets.length} set</span>` : ''}</button>`;
  if (!open) return `<section class="ex" aria-label="${esc(e.name)}">${head}</div></section>`;

  const lt = lastTime(e.name, ui.date);
  const best = bestE1(e.name);
  const total = exerciseHistory(e.name).reduce((a, x) => a + x.sets, 0);
  // Rekor rozeti yalnızca bir kez ve hareket en az iki kez yapıldıysa gösterilir.
  let starDone = false;
  const sets = e.sets
    .map((t, j) => {
      const r = e1rm(t.kg, t.reps);
      const isBest = !starDone && r > 0 && total > 1 && Math.abs(r - best) < 0.001;
      if (isBest) starDone = true;
      const w =
        t.kg > 0
          ? `${fmt(t.kg)}<small>kg</small>`
          : `<small style="font-size:17px;color:var(--ink)">Vücut ağırlığı</small>`;
      return `<li><button class="set" data-act="editset" data-ex="${i}" data-set="${j}" aria-label="Set ${j + 1}: ${fmt(t.kg)} kilo, ${t.reps} tekrar. Düzenle">
      <span class="n">${j + 1}</span>
      <span class="w">${w}<span class="x">×</span>${t.reps}</span>
      <span class="rm">${isBest ? '<span class="star">Rekor</span><br>' : ''}${r ? `1TM ≈ ${fmt(r, 0)}` : ''}</span></button></li>`;
    })
    .join('');
  const lastTxt = lt
    ? `<div class="last"><b>Son sefer</b> (${esc(shortDate(lt.date))}): ${lt.sets.map(t => `${fmt(t.kg)}×${t.reps}`).join(', ')}${lt.note ? `<br><b>Notun:</b> ${esc(lt.note)}` : ''}</div>`
    : '';

  return `<section class="ex open" aria-label="${esc(e.name)}">
    ${head}
      <button class="iconbtn" data-act="exmenu" data-ex="${i}" aria-label="${esc(e.name)} seçenekleri">${dots}</button></div>
    ${lastTxt}
    ${!e.sets.length ? suggestionLine(e) : ''}
    ${e.note ? `<div class="exnote">${esc(e.note)}</div>` : ''}
    ${sets ? `<ul class="sets">${sets}</ul>` : ''}
    <div class="exactions">
      <button class="btn primary grow" data-act="addset" data-ex="${i}">${plus()}Set ekle</button>
      ${e.sets.length ? `<button class="btn grow" data-act="repeat" data-ex="${i}">Son seti tekrarla</button>` : ''}
    </div></section>`;
}
