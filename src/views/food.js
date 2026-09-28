import { weekHead } from '../components/week-nav.js';
import { MEALS } from '../data/foods.js';
import { dayTotals, itemVals, kcalStatus, recentAverage } from '../domain/nutrition.js';
import {
  addDays,
  DAY_NAMES,
  longDate,
  parseYmd,
  relativeDayTitle,
  todayStr,
  weekdayLong,
} from '../lib/date.js';
import { esc } from '../lib/dom.js';
import { fmt } from '../lib/format.js';
import { store } from '../state/store.js';
import { ui } from '../state/ui.js';
import { chevronDown, plus } from '../ui/icons.js';

const GLASS_L = 0.25;
const DEFAULT_WATER_GLASSES = 10;

export function renderFood() {
  return ui.foodOpen ? renderFoodDay() : renderFoodWeek();
}

/** Hafta şeridi: her günün kalorisi hedefe göre renkli. */
function weekStrip() {
  const t = todayStr();
  let out = '';
  for (let i = 0; i < 7; i++) {
    const d = addDays(ui.weekStart, i);
    const st = kcalStatus(d);
    const sel = d === ui.foodOpen;
    out += `<button class="day${d === t ? ' today' : ''}${sel ? ' sel' : ''}" data-date="${d}" aria-label="${esc(longDate(d))}${st ? `, ${fmt(st.k, 0)} kilokalori${st.txt ? ', ' + st.txt : ''}` : ''}" aria-expanded="${sel}">
      <span class="dn">${DAY_NAMES[i]}</span><span class="dd">${parseYmd(d).getDate()}</span>${st ? `<span class="kc ${st.cls}">${fmt(st.k, 0)}</span>` : `<span class="kc empty">${d <= t ? '–' : ''}</span>`}</button>`;
  }
  return weekHead() + `<div class="week">${out}</div>`;
}

function ring(val, goal) {
  const R = 58;
  const C = 2 * Math.PI * R;
  const frac = goal ? Math.min(1, val / goal) : 0;
  return `<svg width="148" height="148" viewBox="0 0 148 148" aria-hidden="true"><circle cx="74" cy="74" r="${R}" fill="none" stroke="var(--surface-2)" stroke-width="13"/>
    ${frac > 0.005 ? `<circle cx="74" cy="74" r="${R}" fill="none" stroke="var(--orange)" stroke-width="13" stroke-linecap="round" stroke-dasharray="${(C * frac).toFixed(1)} ${C.toFixed(1)}" transform="rotate(-90 74 74)"/>` : ''}</svg>`;
}

function macroBar(label, val, goal, color) {
  const pct = goal ? Math.min(100, (val / goal) * 100) : 0;
  return `<div class="mb"><div class="mbt"><span>${label}</span><span class="num"><b>${fmt(val, 0)}</b>${goal ? ` / ${fmt(goal, 0)}` : ''} g</span></div>
    <div class="mbbar"><i style="width:${pct}%;background:${color}"></i></div></div>`;
}

const macroBars = (tot, g) =>
  macroBar('Protein', tot.p, g ? g.p : 0, 'var(--blue)') +
  macroBar('Karbonhidrat', tot.c, g ? g.c : 0, 'var(--yellow)') +
  macroBar('Yağ', tot.f, g ? g.f : 0, 'var(--red)');

function averageLine() {
  const avg = recentAverage();
  if (!avg) return '';
  return `<p class="avgline">Son 7 günde kayıt girdiğin ${avg.days} günün ortalaması: <b>${fmt(avg.k, 0)} kcal</b>, <b>${fmt(avg.p, 0)} g protein</b></p>`;
}

const editGoalsLink = g =>
  g && g.kcal
    ? `<button class="textbtn" data-act="goals" style="margin-top:6px">Hedeflerimi düzenle</button>`
    : '';

function summaryCard(tot, g) {
  if (g && g.kcal) {
    const left = g.kcal - tot.k;
    return `<div class="nsum">
      <div class="ringwrap">${ring(tot.k, g.kcal)}<div class="ringtxt"><b class="num">${fmt(Math.abs(left), 0)}</b><span>${left >= 0 ? 'kcal kaldı' : 'kcal fazla'}</span></div></div>
      <div class="macros"><div class="kcalline"><span class="num"><b>${fmt(tot.k, 0)}</b> / ${fmt(g.kcal, 0)}</span> kcal</div>
        ${macroBars(tot, g)}</div></div>`;
  }
  return `<div class="nsum"><div class="macros" style="flex:1"><div class="kcalline"><span class="num"><b>${fmt(tot.k, 0)}</b></span> kcal alındı</div>
      ${macroBars(tot, null)}</div></div>
      <button class="goalcta" data-act="goals"><b>Günlük hedeflerini hesaplayalım</b><span>Boy, kilo, yaş ve antrenman sıklığına göre kalori ve protein hedefini çıkarırım.</span></button>`;
}

function waterCard(d, g) {
  const goal = (g && g.water) || DEFAULT_WATER_GLASSES;
  const w = (d && d.water) || 0;
  let glasses = '';
  for (let i = 0; i < Math.max(goal, w); i++) {
    const full = i < w;
    glasses += `<button class="glass${full ? ' full' : ''}" data-act="water" data-n="${i + 1}" aria-label="${i + 1}. bardak"><svg width="22" height="28" viewBox="0 0 22 28" aria-hidden="true"><path d="M2 2h18l-2.2 22.5a2 2 0 0 1-2 1.5H6.2a2 2 0 0 1-2-1.5z" fill="${full ? 'var(--blue)' : 'none'}" fill-opacity="${full ? '.85' : '0'}" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg></button>`;
  }
  return `<div class="water"><div class="wt"><span>Su</span><span class="num"><b>${fmt(w * GLASS_L, 2)}</b> / ${fmt(goal * GLASS_L, 2)} L</span></div><div class="glasses">${glasses}</div></div>`;
}

function mealCards(d) {
  return MEALS.map(([k, label]) => {
    const items = (d ? d.items : []).map((it, i) => ({ it, i })).filter(x => x.it.meal === k);
    const mealKcal = items.reduce((a, x) => a + itemVals(x.it).k, 0);
    const list = items
      .map(({ it, i }) => {
        const v = itemVals(it);
        return `<li><button class="fitem" data-act="editfood" data-i="${i}">
        <span><span class="fn">${esc(it.name)}</span><span class="fg">${fmt(it.g, 0)} g${it.pl && it.pg ? `, ${fmt(it.g / it.pg, 1)} ${esc(it.pl)}` : ''}</span></span>
        <span class="fk"><b class="num">${fmt(v.k, 0)}</b> kcal<br><span>P ${fmt(v.p, 0)} g</span></span></button></li>`;
      })
      .join('');
    return `<section class="meal"><div class="mealhead"><h3>${label}</h3>${items.length ? `<span class="num">${fmt(mealKcal, 0)} kcal</span>` : ''}</div>
      ${items.length ? `<ul class="fitems">${list}</ul>` : ''}
      <button class="mealadd" data-act="addfood" data-meal="${k}">${plus(16)}${label} için ekle</button></section>`;
  }).join('');
}

function renderFoodDay() {
  ui.date = ui.foodOpen;
  const g = store.goals;
  const d = store.food[ui.date];
  const s = store.sessions[ui.date];
  const trained = s && s.exercises.some(e => e.sets.length);
  return (
    weekStrip() +
    `
  <div class="dayline"><h1>${esc(relativeDayTitle(ui.date))}</h1><p>${trained ? 'Antrenman günü, ' : ''}${esc(weekdayLong(ui.date))} <button class="textbtn closeday" data-act="foodclose" style="margin-left:4px" aria-expanded="true">Kapat${chevronDown}</button></p></div><div class="fooddetail${ui.justOpened ? ' drop' : ''}">
  ${summaryCard(dayTotals(ui.date), g)}${waterCard(d, g)}${mealCards(d)}${averageLine()}
  ${editGoalsLink(g)}</div>`
  );
}

function renderFoodWeek() {
  const t = todayStr();
  const g = store.goals;
  let hit = 0;
  let logged = 0;
  for (let i = 0; i < 7; i++) {
    const st = kcalStatus(addDays(ui.weekStart, i));
    if (st && st.cls !== 'pending') {
      logged++;
      if (st.cls === 'ok') hit++;
    }
  }
  const goalInfo =
    g && g.kcal
      ? `<div class="legendrow"><span><i style="background:var(--green)"></i>Hedefe yakın (${fmt(Math.round((g.kcal * 0.9) / 10) * 10, 0)}–${fmt(Math.round((g.kcal * 1.1) / 10) * 10, 0)} kcal)</span><span><i style="background:var(--red)"></i>Hedefin dışında</span><span><i style="background:var(--surface-2);border:1px solid var(--line)"></i>Bugün, henüz altında</span></div>
   ${logged ? `<p class="avgline">Bu hafta kayıt girdiğin ${logged} günün ${hit} tanesinde hedefe ulaştın.</p>` : ''}`
      : `<button class="goalcta" data-act="goals" style="margin-top:12px"><b>Günlük kalori hedefini belirle</b><span>Hedefin olunca günler yeşil ya da kırmızı görünür.</span></button>`;
  return (
    weekStrip() +
    `
  <div class="dayline"><h1>Beslenme</h1><p>Detay için bir güne dokun</p></div>
  ${goalInfo}
  ${averageLine()}
  <button class="openday" data-act="openday" data-d="${t}" aria-expanded="false">Bugünü aç${chevronDown}</button>
  ${editGoalsLink(g)}`
  );
}
