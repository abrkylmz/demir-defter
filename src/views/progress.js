import { progressChart } from '../components/charts.js';
import { exerciseHistory, loggedNames, recentNames } from '../domain/workout.js';
import { shortDate } from '../lib/date.js';
import { esc } from '../lib/dom.js';
import { fmt, nameKey } from '../lib/format.js';
import { ui } from '../state/ui.js';

export function renderProgress() {
  const names = loggedNames();
  if (!names.length)
    return `<div class="dayline"><h1>İlerleme</h1></div><div class="empty"><p>Bir hareketi en az bir kez kaydettiğinde gelişimini burada izleyebilirsin.</p><button class="btn primary" data-tab="log">Antrenmana git</button></div>`;
  if (!ui.progress || !names.some(n => nameKey(n) === nameKey(ui.progress)))
    ui.progress = recentNames(1)[0] || names[0];

  const h = exerciseHistory(ui.progress);
  let heavy = h[0].top;
  let bestE = 0;
  let bestEDate = '';
  h.forEach(x => {
    if (x.top.kg > heavy.kg || (x.top.kg === heavy.kg && x.top.reps > heavy.reps)) heavy = x.top;
    if (x.e1 > bestE) {
      bestE = x.e1;
      bestEDate = x.date;
    }
  });
  const first = h[0];
  const last = h[h.length - 1];
  const delta = h.length > 1 && first.e1 && last.e1 ? last.e1 - first.e1 : null;

  return `<div class="dayline"><h1>İlerleme</h1>${delta !== null ? `<p>${delta >= 0 ? '+' : ''}${fmt(delta, 1)} kg tahmini 1TM, ilk kayda göre</p>` : ''}</div>
  <div class="field"><label for="exsel">Hareket</label>
    <select id="exsel" class="sel">${names.map(n => `<option ${nameKey(n) === nameKey(ui.progress) ? 'selected' : ''}>${esc(n)}</option>`).join('')}</select></div>
  <div class="summary">
    <div><b class="num">${heavy.kg > 0 ? fmt(heavy.kg) : '—'}</b><span>en ağır (kg), ${heavy.reps} tekrar</span></div>
    <div><b class="num">${bestE ? fmt(bestE, 0) : '—'}</b><span>tahmini 1TM${bestEDate ? ', ' + shortDate(bestEDate) : ''}</span></div>
    <div><b class="num">${h.length}</b><span>antrenmanda yapıldı</span></div>
  </div>
  <div class="chartcard">${h.length > 1 ? progressChart(h, ui.progress) : `<p style="margin:10px 6px 14px;color:var(--ink-2)">Grafik için bu hareketi bir antrenmanda daha kaydet.</p>`}</div>
  <div class="chartcard" style="padding:6px 14px"><ul class="plist">
    ${h
      .slice()
      .reverse()
      .map(
        x =>
          `<li><span>${esc(shortDate(x.date))}</span><span style="text-align:right"><span class="r">${x.top.kg > 0 ? fmt(x.top.kg) + ' kg' : 'VA'} × ${x.top.reps}</span><br><span style="color:var(--ink-3);font-size:13px">${x.e1 ? '1TM ≈ ' + fmt(x.e1, 0) : ''}</span></span></li>`,
      )
      .join('')}
  </ul></div>`;
}
