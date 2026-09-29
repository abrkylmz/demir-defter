// Haftalık / aylık rapor ekranı. Hesaplar domain/report.ts'te; burada yalnızca sunum.
// Renk kuralı: değişimler nötr metin + ▲▼ ile gösterilir; iyi/kötü yargısı "Öne çıkanlar"da kelimelerle verilir.
import { kcalColumns } from '../components/charts.ts';
import { buildReport, nextAnchor, pctChange, type Report } from '../domain/report.ts';
import { DAY_NAMES, dayMonth, monthYear, parseYmd, shortDate, todayStr } from '../lib/date.ts';
import { esc } from '../lib/dom.ts';
import { fmt } from '../lib/format.ts';
import { ui } from '../state/ui.ts';
import { chevronLeft, chevronRight } from '../ui/icons.ts';

const vsText = (r: Report) => (r.period === 'week' ? 'geçen haftaya göre' : 'geçen aya göre');

/** "▲ %12 geçen haftaya göre" — karşılaştırılamıyorsa boş. */
function deltaPct(r: Report, now: number | null, prev: number | null): string {
  const pct = pctChange(now, prev);
  if (pct === null) return '';
  const sign = pct > 0 ? '▲' : pct < 0 ? '▼' : '=';
  return `<span class="rdelta">${sign} ${pct === 0 ? 'aynı' : `%${Math.abs(pct)}`} ${vsText(r)}</span>`;
}

function deltaAbs(r: Report, now: number, prev: number, unit: string): string {
  const d = now - prev;
  if (!prev && !now) return '';
  const sign = d > 0 ? '▲' : d < 0 ? '▼' : '=';
  return `<span class="rdelta">${sign} ${d === 0 ? 'aynı' : `${Math.abs(d)} ${unit}`} ${vsText(r)}</span>`;
}

const tile = (label: string, value: string, delta = '') =>
  `<div class="rtile"><span class="rlabel">${label}</span><b class="rvalue">${value}</b>${delta}</div>`;

/** 1.250 kg → "1,3 t" */
const volumeText = (kg: number) => (kg >= 1000 ? `${fmt(kg / 1000, 1)} t` : `${fmt(kg, 0)} kg`);

function periodTitle(r: Report): string {
  const { from, to } = r.range;
  if (r.period === 'month') return monthYear(from);
  const a = parseYmd(from);
  const b = parseYmd(to);
  return a.getMonth() === b.getMonth()
    ? `${a.getDate()}–${b.getDate()} ${b.toLocaleDateString('tr-TR', { month: 'long' })}`
    : `${dayMonth(from)} – ${dayMonth(to)}`;
}

function header(r: Report): string {
  const seg = (v: 'week' | 'month', l: string) =>
    `<button class="seg" role="tab" data-act="rperiod" data-v="${v}" aria-selected="${ui.reportPeriod === v}">${l}</button>`;
  const canNext = nextAnchor(r.period, r.range.from) <= todayStr();
  return `<div class="dayline"><h1>Rapor</h1></div>
  <div class="segs" role="tablist" aria-label="Dönem">${seg('week', 'Haftalık')}${seg('month', 'Aylık')}</div>
  <div class="weekhead">
    <button class="iconbtn" data-act="rnav" data-dir="-1" aria-label="Önceki dönem">${chevronLeft}</button>
    <h2>${esc(periodTitle(r))}</h2>
    <div style="display:flex;align-items:center">
      ${r.current ? '' : '<button class="textbtn" data-act="rnav" data-dir="0">Bugün</button>'}
      <button class="iconbtn" data-act="rnav" data-dir="1" aria-label="Sonraki dönem" ${canNext ? '' : 'disabled'}>${chevronRight}</button>
    </div>
  </div>`;
}

function insightsCard(r: Report): string {
  if (!r.insights.length) return '';
  return `<section class="rcard"><h3>Öne çıkanlar</h3><ul class="rinsights">${r.insights.map(s => `<li>${esc(s)}</li>`).join('')}</ul></section>`;
}

function workoutCard(r: Report): string {
  const w = r.workout;
  const p = r.prevWorkout;
  if (!w.sessions)
    return `<section class="rcard"><h3>Antrenman</h3><p class="hint">Bu dönemde antrenman kaydı yok.</p></section>`;
  const max = Math.max(...r.groups.map(g => g.sets), 1);
  const groups = r.groups
    .map(
      g =>
        `<li><span class="rg-name">${esc(g.group)}</span><span class="rg-track" aria-hidden="true"><i style="width:${(g.sets / max) * 100}%"></i></span><span class="rg-val">${g.sets} set</span></li>`,
    )
    .join('');
  // Hareket başına tek satır: dönemdeki ilk rekordan önceki değer → son rekor; en büyük artış üstte, en fazla 5
  const MAX_RECORDS = 5;
  const byExercise = new Map<
    string,
    { name: string; from: number; to: number; count: number; last: string }
  >();
  for (const e of r.records) {
    const x = byExercise.get(e.name);
    if (x) Object.assign(x, { to: e.value, count: x.count + 1, last: e.date });
    else byExercise.set(e.name, { name: e.name, from: e.prev, to: e.value, count: 1, last: e.date });
  }
  const all = [...byExercise.values()].sort((a, b) => b.to - b.from - (a.to - a.from));
  const top = all.slice(0, MAX_RECORDS);
  const records = r.records.length
    ? `<h4>Rekorlar (${r.records.length})</h4><ul class="rrecords">${top
        .map(
          x =>
            `<li><span><b>${esc(x.name)}</b><small>${x.count > 1 ? `${x.count} rekor, son ` : ''}${esc(shortDate(x.last))}</small></span><span class="num">${fmt(x.from, 0)} → <b>${fmt(x.to, 0)}</b> kg</span></li>`,
        )
        .join(
          '',
        )}</ul><p class="hint" style="margin-top:4px">${all.length > top.length ? `ve ${all.length - top.length} hareket daha · ` : ''}Tahmini 1TM</p>`
    : '';
  return `<section class="rcard"><h3>Antrenman</h3>
    <div class="rtiles">
      ${tile('Antrenman', `${w.sessions}<small>/${w.goal}</small>`, deltaAbs(r, w.sessions, p.sessions, 'antrenman'))}
      ${tile('Set', fmt(w.sets, 0), deltaPct(r, w.sets, p.sets || null))}
      ${tile('Hacim', volumeText(w.volume), deltaPct(r, w.volume, p.volume || null))}
    </div>
    <h4>Kas grupları</h4><ul class="rgroups">${groups}</ul>
    ${records}</section>`;
}

function nutritionCard(r: Report): string {
  const n = r.nutrition;
  const p = r.prevNutrition;
  if (!n.logged)
    return `<section class="rcard"><h3>Beslenme</h3><p class="hint">Bu dönemde beslenme kaydı yok.</p></section>`;
  const labels =
    r.period === 'week'
      ? DAY_NAMES
      : n.days.map((d, i) => (i % 7 === 0 ? String(parseYmd(d.date).getDate()) : ''));
  const sel = ui.reportSel !== null && ui.reportSel < n.days.length ? ui.reportSel : null;
  const selDay = sel !== null ? n.days[sel] : null;
  const caption = selDay
    ? `<b>${esc(parseYmd(selDay.date).toLocaleDateString('tr-TR', { weekday: 'short', day: 'numeric', month: 'short' }))}</b> · ${
        selDay.k !== null ? `${fmt(selDay.k, 0)} kcal, ${fmt(selDay.p ?? 0, 0)} g protein` : 'kayıt yok'
      }`
    : 'Bir güne dokunarak değerini gör';
  const rows = n.days
    .filter(d => d.k !== null)
    .map(
      d =>
        `<tr><td>${esc(parseYmd(d.date).toLocaleDateString('tr-TR', { weekday: 'short', day: 'numeric', month: 'short' }))}</td><td class="num">${fmt(d.k ?? 0, 0)}</td><td class="num">${fmt(d.p ?? 0, 0)}</td></tr>`,
    )
    .join('');
  return `<section class="rcard"><h3>Beslenme</h3>
    <div class="rtiles">
      ${tile('Ort. kalori', `${fmt(n.avgK ?? 0, 0)}<small> kcal</small>`, deltaPct(r, n.avgK, p.avgK))}
      ${tile('Ort. protein', `${fmt(n.avgP ?? 0, 0)}<small> g</small>`, deltaPct(r, n.avgP, p.avgP))}
      ${tile('Kayıtlı gün', `${n.logged}<small>/${n.days.length}</small>`, n.goalK ? `<span class="rdelta">${n.kcalHit} gün kalori hedefinde</span>` : '')}
    </div>
    <h4>Günlük kalori</h4>
    <div class="rchart">${kcalColumns(n.days, n.goalK, labels, sel)}</div>
    <p class="rcaption" aria-live="polite">${caption}</p>
    <details class="rtable"><summary>Tablo olarak göster</summary>
      <table><thead><tr><th>Gün</th><th>kcal</th><th>Protein (g)</th></tr></thead><tbody>${rows}</tbody></table>
    </details></section>`;
}

function bodyCard(r: Report): string {
  const b = r.body;
  if (!b.entries)
    return `<section class="rcard"><h3>Kilo</h3><p class="hint">Bu dönemde tartı kaydı yok.</p></section>`;
  const change =
    b.change === null
      ? '—'
      : `${b.change > 0 ? '+' : b.change < 0 ? '−' : ''}${fmt(Math.abs(b.change), 1)}<small> kg</small>`;
  return `<section class="rcard"><h3>Kilo</h3>
    <div class="rtiles">
      ${tile('Başlangıç', `${fmt(b.start ?? 0, 1)}<small> kg</small>`)}
      ${tile('Son', `${fmt(b.end ?? 0, 1)}<small> kg</small>`)}
      ${tile('Değişim', change)}
    </div></section>`;
}

export function renderReport(): string {
  const r = buildReport(ui.reportPeriod, ui.reportAnchor);
  const empty = !r.workout.sessions && !r.nutrition.logged && !r.body.entries;
  return `${header(r)}
  ${
    empty
      ? `<div class="empty"><p>Bu dönemde kayıt yok. Antrenman, beslenme ya da tartı girdikçe raporun burada oluşur.</p></div>`
      : `${insightsCard(r)}${workoutCard(r)}${nutritionCard(r)}${bodyCard(r)}`
  }`;
}

/** Ana ekrandaki kısa rapor satırı için bu haftanın özeti. */
export function reportTeaser(): string {
  const r = buildReport('week', todayStr());
  const parts = [`${r.workout.sessions}/${r.workout.goal} antrenman`];
  if (r.nutrition.avgK !== null) parts.push(`ort. ${fmt(r.nutrition.avgK, 0)} kcal`);
  if (r.body.change !== null) parts.push(`${r.body.change > 0 ? '+' : ''}${fmt(r.body.change, 1)} kg`);
  return parts.join(' · ');
}
