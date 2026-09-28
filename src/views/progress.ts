import { progressChart } from '../components/charts.ts';
import { allRecords, isFresh } from '../domain/records.ts';
import { exerciseHistory, loggedNames, recentNames } from '../domain/workout.ts';
import { shortDate } from '../lib/date.ts';
import { esc } from '../lib/dom.ts';
import { fmt, nameKey } from '../lib/format.ts';
import { ui } from '../state/ui.ts';

/** Başlık ve Grafik / Rekorlar geçişi. */
function viewSwitch(): string {
  const tab = (v: 'chart' | 'records', label: string) =>
    `<button class="seg" role="tab" data-act="pview" data-v="${v}" aria-selected="${ui.progressView === v}">${label}</button>`;
  return `<div class="dayline"><h1>İlerleme</h1></div>
  <div class="segs" role="tablist" aria-label="Görünüm">${tab('chart', 'Grafik')}${tab('records', 'Rekorlar')}</div>`;
}

const setText = (kg: number, reps: number) => (kg > 0 ? `${fmt(kg)} kg × ${reps}` : `${reps} tekrar`);

/** Her hareketin rekorları; son 7 günde kırılanlar "Yeni" rozetiyle. */
function renderRecords(): string {
  const list = allRecords();
  const fresh = list.filter(r => isFresh(r.latest)).length;
  const rows = list
    .map(r => {
      const best = r.e1
        ? `<b class="num">${fmt(r.e1.value, 0)}</b><small> kg 1TM</small>`
        : r.mostReps
          ? `<b class="num">${r.mostReps.value.reps}</b><small> tekrar</small>`
          : '';
      // Ağırlıklı harekette en ağır set, vücut ağırlığında ana değer zaten tekrar sayısı.
      const details =
        r.heaviest && r.heaviest.value.kg > 0
          ? [`En ağır ${setText(r.heaviest.value.kg, r.heaviest.value.reps)}`]
          : [];
      return `<li><button class="prow" data-act="prchart" data-name="${esc(r.name)}">
        <span class="prow-main"><span class="prow-name">${esc(r.name)}${isFresh(r.latest) ? '<span class="badge-new">Yeni</span>' : ''}</span>
        <span class="prow-meta">${esc(details.join(' · '))}${details.length ? ' · ' : ''}${esc(shortDate(r.latest))}</span></span>
        <span class="prow-best">${best}</span></button></li>`;
    })
    .join('');
  return `<p class="deltaline">${list.length} hareket${fresh ? `, son 7 günde ${fresh} tanesinde rekor kırdın` : ''}</p>
  <ul class="prlist">${rows}</ul>`;
}

export function renderProgress(): string {
  const names = loggedNames();
  if (!names.length)
    return `<div class="dayline"><h1>İlerleme</h1></div><div class="empty"><p>Bir hareketi en az bir kez kaydettiğinde gelişimini burada izleyebilirsin.</p><button class="btn primary" data-tab="log">Antrenmana git</button></div>`;
  if (ui.progressView === 'records') return viewSwitch() + renderRecords();
  const current = ui.progress;
  const selected =
    current && names.some(n => nameKey(n) === nameKey(current)) ? current : recentNames(1)[0] || names[0];
  ui.progress = selected;

  const h = exerciseHistory(selected);
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

  return `${viewSwitch()}${delta !== null ? `<p class="deltaline">${delta >= 0 ? '+' : ''}${fmt(delta, 1)} kg tahmini 1TM, ilk kayda göre</p>` : ''}
  <div class="field"><label for="exsel">Hareket</label>
    <select id="exsel" class="sel">${names.map(n => `<option ${nameKey(n) === nameKey(selected) ? 'selected' : ''}>${esc(n)}</option>`).join('')}</select></div>
  <div class="summary">
    <div><b class="num">${heavy.kg > 0 ? fmt(heavy.kg) : '—'}</b><span>en ağır (kg), ${heavy.reps} tekrar</span></div>
    <div><b class="num">${bestE ? fmt(bestE, 0) : '—'}</b><span>tahmini 1TM${bestEDate ? ', ' + shortDate(bestEDate) : ''}</span></div>
    <div><b class="num">${h.length}</b><span>antrenmanda yapıldı</span></div>
  </div>
  <div class="chartcard">${h.length > 1 ? progressChart(h, selected) : `<p style="margin:10px 6px 14px;color:var(--ink-2)">Grafik için bu hareketi bir antrenmanda daha kaydet.</p>`}</div>
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
