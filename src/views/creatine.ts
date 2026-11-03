// Kreatin sekmesi: bugünü tek dokunuşla işaretle, aylık takvimde geçmiş günleri düzelt, sıklığı gör.
import { monthCount, suppCount, suppStats } from '../domain/supplements.ts';
import {
  addDays,
  addMonths,
  DAY_NAMES,
  daysAgoText,
  longDate,
  monthStart,
  monthYear,
  parseYmd,
  todayStr,
} from '../lib/date.ts';
import { esc } from '../lib/dom.ts';
import { ui } from '../state/ui.ts';
import { check, chevronLeft, chevronRight } from '../ui/icons.ts';

function todayButton(t: string): string {
  const on = suppCount(t, 'creatine') > 0;
  return `<button class="crtoday${on ? ' on' : ''}" data-act="crtoggle" data-d="${t}" aria-pressed="${on}">
    <span class="crmark">${on ? check(30) : ''}</span>
    <span><b>${on ? 'Bugün alındı' : 'Bugün aldım'}</b><span>${on ? 'Geri almak için tekrar dokun' : 'Aldığında dokun, gün işaretlensin'}</span></span></button>`;
}

function summary(): string {
  const s = suppStats('creatine');
  const box = (val: string, label: string) => `<div><b class="num">${val}</b><span>${label}</span></div>`;
  return `<div class="summary">${box(String(s.streak), 'gün seri')}${box(`${s.week}/7`, 'son 7 gün')}${box(`${s.month}/30`, 'son 30 gün')}</div>
  ${s.last && !s.week ? `<p class="avgline">Son alım ${esc(daysAgoText(s.last))}.</p>` : ''}`;
}

function calendar(t: string): string {
  const m = ui.crMonth;
  const isCurrent = m === monthStart(t);
  const lead = (parseYmd(m).getDay() + 6) % 7;
  const days = parseYmd(addDays(addMonths(m, 1), -1)).getDate();
  let cells = '<span></span>'.repeat(lead);
  for (let i = 0; i < days; i++) {
    const d = addDays(m, i);
    const on = suppCount(d, 'creatine') > 0;
    const future = d > t;
    cells += `<button class="crday${on ? ' on' : ''}${d === t ? ' today' : ''}" data-act="crtoggle" data-d="${d}" aria-pressed="${on}" aria-label="${esc(longDate(d))}${on ? ', alındı' : ''}"${future ? ' disabled' : ''}>
      <span class="num">${i + 1}</span>${on ? check(12) : ''}</button>`;
  }
  const n = monthCount('creatine', m.slice(0, 7));
  return `<section class="crcal" aria-label="Kreatin takvimi">
    <div class="weekhead">
      <button class="iconbtn" data-act="crmonth" data-dir="-1" aria-label="Önceki ay">${chevronLeft}</button>
      <h2>${esc(monthYear(m))}</h2>
      <button class="iconbtn" data-act="crmonth" data-dir="1" aria-label="Sonraki ay"${isCurrent ? ' disabled' : ''}>${chevronRight}</button>
    </div>
    <div class="crgrid crnames" aria-hidden="true">${DAY_NAMES.map(x => `<span>${x}</span>`).join('')}</div>
    <div class="crgrid">${cells}</div>
    <p class="avgline">${n ? `Bu ay <b>${n}</b> gün aldın.` : 'Bu ay henüz kayıt yok.'} Geçmiş bir günü işaretlemek ya da kaldırmak için güne dokun.</p>
  </section>`;
}

export function renderCreatine(): string {
  const t = todayStr();
  return `<div class="dayline"><h1>Kreatin</h1><p>Günlük kullanım takibi</p></div>
  ${todayButton(t)}${summary()}${calendar(t)}`;
}
