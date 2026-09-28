import { latestWeight } from '../domain/body.js';
import { dayTotals } from '../domain/nutrition.js';
import { loggedNames, sortedDates } from '../domain/workout.js';
import { dayMonth, longDate, mondayOf, todayStr } from '../lib/date.js';
import { esc } from '../lib/dom.js';
import { fmt } from '../lib/format.js';
import { store } from '../state/store.js';
import { tileIcon } from '../ui/icons.js';

function greeting(hour) {
  if (hour < 5) return 'İyi geceler';
  if (hour < 12) return 'Günaydın';
  if (hour < 18) return 'İyi günler';
  return 'İyi akşamlar';
}

export function renderHome() {
  const t = todayStr();
  const s = store.sessions[t];
  const todayEx = s ? s.exercises.map(e => e.name) : [];
  const ds = sortedDates();
  const lastW = ds.filter(d => d < t).pop();

  const logTxt = todayEx.length
    ? `Bugün: ${esc(todayEx.slice(0, 3).join(', '))}${todayEx.length > 3 ? ` ve ${todayEx.length - 3} hareket daha` : ''}`
    : lastW
      ? `Son antrenman: ${esc(dayMonth(lastW))}`
      : 'Bugünkü antrenmanını kaydet';

  const weekCount = ds.filter(d => d >= mondayOf(t)).length;
  const histTxt = ds.length
    ? `${ds.length} antrenman kayıtlı, bu hafta ${weekCount}`
    : 'Kayıtlı antrenmanların';

  const names = loggedNames();
  const progTxt = names.length ? `${names.length} hareketin gelişimi` : 'Hareket bazında gelişimin';

  const ft = dayTotals(t);
  const g = store.goals;
  const foodTxt =
    ft.k > 0
      ? `Bugün ${fmt(ft.k, 0)}${g && g.kcal ? ' / ' + fmt(g.kcal, 0) : ''} kcal, ${fmt(ft.p, 0)} g protein`
      : g && g.kcal
        ? `Hedefin ${fmt(g.kcal, 0)} kcal, ${fmt(g.p, 0)} g protein`
        : 'Kalori ve protein takibi';

  const w = latestWeight();
  const bodyTxt = w !== null ? `Son tartı ${fmt(w, 1)} kg` : 'Tartılarını kaydet';

  return `<div class="hello"><h1>${greeting(new Date().getHours())}</h1><p>${esc(longDate(t))}</p></div>
  <div class="tiles">
    <button class="tile wide" style="--c:var(--blue)" data-tab="log" data-home="today">${tileIcon('log')}<div><h2>Antrenman</h2><p>${logTxt}</p></div><span class="go" aria-hidden="true">›</span></button>
    <button class="tile wide" style="--c:var(--orange)" data-tab="food" data-home="today">${tileIcon('food', 40)}<div><h2>Beslenme</h2><p>${foodTxt}</p></div><span class="go" aria-hidden="true">›</span></button>
    <button class="tile" style="--c:var(--yellow)" data-tab="history">${tileIcon('history')}<div><h2>Geçmiş</h2><p>${histTxt}</p></div></button>
    <button class="tile" style="--c:var(--green)" data-tab="progress">${tileIcon('progress')}<div><h2>İlerleme</h2><p>${progTxt}</p></div></button>
    <button class="tile wide" style="--c:var(--red)" data-tab="body">${tileIcon('body')}<div><h2>Kilo</h2><p>${bodyTxt}</p></div><span class="go" aria-hidden="true">›</span></button>
  </div>`;
}
