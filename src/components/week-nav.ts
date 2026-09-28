import { addDays, mondayOf, monthYear, todayStr } from '../lib/date.ts';
import { esc } from '../lib/dom.ts';
import { ui } from '../state/ui.ts';
import { chevronLeft, chevronRight } from '../ui/icons.ts';

/** Ay başlığı, önceki/sonraki hafta ve "Bugün" düğmesi. Antrenman ve beslenme ekranlarında ortak. */
export function weekHead() {
  const t = todayStr();
  const showToday = mondayOf(t) !== ui.weekStart || ui.date !== t;
  return `<div class="weekhead">
    <button class="iconbtn" data-act="week" data-dir="-1" aria-label="Önceki hafta">${chevronLeft}</button>
    <h2>${esc(monthYear(addDays(ui.weekStart, 3)))}</h2>
    <div style="display:flex;align-items:center">
      ${showToday ? '<button class="textbtn" data-act="today">Bugün</button>' : ''}
      <button class="iconbtn" data-act="week" data-dir="1" aria-label="Sonraki hafta">${chevronRight}</button>
    </div>
  </div>`;
}
