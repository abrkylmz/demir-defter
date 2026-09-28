import { GROUPS, OTHER_GROUP } from '../data/exercises.ts';
import { groupSets, sortedDates } from '../domain/workout.ts';
import { addDays, mondayOf, monthYear, parseYmd, todayStr, weekdayShort } from '../lib/date.ts';
import { esc } from '../lib/dom.ts';
import { store } from '../state/store.ts';
import type { DateStr } from '../types.ts';

/** Üst üste antrenman yapılan hafta sayısı (bu hafta henüz boşsa geçen haftadan sayar). */
function weekStreak(dates: DateStr[], thisMonday: DateStr): number {
  const weeks = new Set(dates.map(mondayOf));
  let w = weeks.has(thisMonday) ? thisMonday : addDays(thisMonday, -7);
  let streak = 0;
  while (weeks.has(w)) {
    streak++;
    w = addDays(w, -7);
  }
  return streak;
}

const truncate = (s: string, n: number) => (s.length > n ? s.slice(0, n).trim() + '…' : s);

export function renderHistory(): string {
  const ds = sortedDates().reverse();
  if (!ds.length)
    return `<div class="dayline"><h1>Geçmiş</h1></div><div class="empty"><p>Henüz kayıtlı antrenman yok. İlk seti girdiğinde burada görünecek.</p><button class="btn primary" data-tab="log">Antrenmana git</button></div>`;

  const t = todayStr();
  const ws = mondayOf(t);
  const thisWeek = ds.filter(d => d >= ws && d <= addDays(ws, 6)).length;
  const thisMonth = ds.filter(d => d >= t.slice(0, 8) + '01').length;

  let html = `<div class="dayline"><h1>Geçmiş</h1><p>${ds.length} antrenman</p></div>
  <div class="summary"><div><b class="num">${thisWeek}</b><span>bu hafta</span></div><div><b class="num">${thisMonth}</b><span>bu ay</span></div><div><b class="num">${weekStreak(ds, ws)}</b><span>hafta üst üste</span></div></div>
  ${muscleCard(ws)}`;

  let month = '';
  ds.forEach(d => {
    const m = monthYear(d);
    if (m !== month) {
      month = m;
      html += `<div class="month">${esc(m)}</div>`;
    }
    const s = store.sessions[d];
    const names = s.exercises.filter(e => e.sets.length).map(e => e.name);
    html += `<button class="hrow" data-act="open" data-date="${d}"><div class="hdate"><div class="d">${parseYmd(d).getDate()}</div><div class="w">${esc(weekdayShort(d))}</div></div>
      <div class="hbody"><div class="names">${esc(names.join(', '))}</div><div class="meta">${names.length} hareket</div>${s.note ? `<div class="meta">“${esc(truncate(s.note, 70))}”</div>` : ''}</div></button>`;
  });

  html += `<div class="toolbar"><span style="color:var(--ink-3);font-size:13.5px">Tüm kayıtların tek dosyada</span><button class="btn" data-act="export">CSV olarak indir</button></div>`;
  return html;
}

/** Bu haftanın kas grubu başına set sayısı; ince çizgi geçen haftayı gösterir. */
function muscleCard(ws: DateStr): string {
  const cur = groupSets(ws, addDays(ws, 6));
  const prev = groupSets(addDays(ws, -7), addDays(ws, -1));
  const groups = GROUPS.filter(g => g !== OTHER_GROUP || cur[g] || prev[g]);
  const max = Math.max(10, ...groups.map(g => Math.max(cur[g] || 0, prev[g] || 0)));
  const rows = groups
    .map(g => {
      const n = cur[g] || 0;
      const p = prev[g] || 0;
      return `<li class="${n ? '' : 'zero'}" aria-label="${esc(g)}: bu hafta ${n} set, geçen hafta ${p} set"><span class="mg">${esc(g)}</span>
      <span class="mtrack" aria-hidden="true"><i style="width:${(n / max) * 100}%"></i>${p ? `<span class="pv" style="left:${(p / max) * 100}%"></span>` : ''}</span>
      <span class="mn" aria-hidden="true">${n ? `${n}<small> set</small>` : '<small>yok</small>'}</span></li>`;
    })
    .join('');
  const missing = GROUPS.filter(g => g !== OTHER_GROUP && !cur[g]);
  const any = Object.keys(cur).length > 0;
  return `<section class="mcard"><h3>Bu hafta kas grupları</h3><div class="sub">Çubuk bu haftanın set sayısı, ince çizgi geçen hafta</div>
    <ul class="mrows">${rows}</ul>
    ${any && missing.length ? `<p class="miss">Bu hafta çalışılmayan: ${esc(missing.join(', '))}</p>` : ''}</section>`;
}
