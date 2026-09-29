import { latestWeight } from '../domain/body.ts';
import { dayTotals } from '../domain/nutrition.ts';
import { weekProgress, type WeekProgress } from '../domain/weekly.ts';
import { loggedNames, sortedDates } from '../domain/workout.ts';
import { greeting } from '../lib/greeting.ts';
import { reportTeaser } from './report.ts';
import { dayMonth, longDate, mondayOf, todayStr } from '../lib/date.ts';
import { esc } from '../lib/dom.ts';
import { fmt } from '../lib/format.ts';
import { store } from '../state/store.ts';
import { isEmpty, summarize } from '../services/backup.ts';
import { canOfferInstall } from '../services/install.ts';
import { backupStatus } from '../sheets/data.ts';
import { tileIcon, utilIcon } from '../ui/icons.ts';

/** Haftalık hedef halkası (kahraman kartında). */
function goalRing(done: number, goal: number): string {
  const R = 30;
  const C = 2 * Math.PI * R;
  const frac = Math.min(1, done / goal);
  return `<svg class="hero-ring" width="76" height="76" viewBox="0 0 76 76" aria-hidden="true">
    <circle cx="38" cy="38" r="${R}" fill="none" stroke="currentColor" stroke-opacity=".22" stroke-width="8"/>
    ${frac > 0 ? `<circle cx="38" cy="38" r="${R}" fill="none" stroke="currentColor" stroke-width="8" stroke-linecap="round" stroke-dasharray="${(C * frac).toFixed(1)} ${C.toFixed(1)}" transform="rotate(-90 38 38)"/>` : ''}
  </svg><span class="hero-ring-txt"><b>${done}</b>/${goal}</span>`;
}

/** Haftalık durum cümlesi: kalan antrenman, gün ve seri. */
function weekLine(p: WeekProgress): string {
  const left = p.goal - p.done;
  const main =
    left <= 0
      ? 'Haftalık hedefin tamam, harika gidiyorsun'
      : left > p.daysLeft
        ? `Bu hafta ${p.done} antrenman; yeni hafta yeni başlangıç`
        : `Hedefe ${left} antrenman kaldı, ${p.daysLeft === 1 ? 'bugün son gün' : `${p.daysLeft} gün var`}`;
  return p.streak >= 2 ? `${main} · ${p.streak} haftadır hedefte` : main;
}

function hero(t: string): string {
  const name = store.profile.name;
  const p = weekProgress(t);
  return `<section class="hero" aria-label="Özet">
    <div class="hero-top">
      <div class="hero-text">
        <p class="hero-date">${esc(longDate(t))}</p>
        <h1>${esc(greeting(new Date().getHours(), name))}</h1>
      </div>
      <button class="hero-goal" data-act="profile" aria-label="Haftalık hedef: ${p.done} / ${p.goal} antrenman. Profili düzenle">${goalRing(p.done, p.goal)}</button>
    </div>
    <p class="hero-sub">${esc(weekLine(p))}</p>
    ${name ? '' : '<button class="hero-cta" data-act="profile">Adını ve haftalık hedefini ekle</button>'}
  </section>`;
}

export function renderHome(): string {
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

  return `${hero(t)}
  <button class="report-link" data-tab="report"><span><b>Haftalık rapor</b><span>${esc(reportTeaser())}</span></span><span class="go" aria-hidden="true">›</span></button>
  <div class="tiles">
    <button class="tile wide" style="--c:var(--blue)" data-tab="log" data-home="today">${tileIcon('log')}<div><h2>Antrenman</h2><p>${logTxt}</p></div><span class="go" aria-hidden="true">›</span></button>
    <button class="tile wide" style="--c:var(--orange)" data-tab="food" data-home="today">${tileIcon('food', 40)}<div><h2>Beslenme</h2><p>${foodTxt}</p></div><span class="go" aria-hidden="true">›</span></button>
    <button class="tile" style="--c:var(--yellow)" data-tab="history">${tileIcon('history')}<div><h2>Geçmiş</h2><p>${histTxt}</p></div></button>
    <button class="tile" style="--c:var(--green)" data-tab="progress">${tileIcon('progress')}<div><h2>İlerleme</h2><p>${progTxt}</p></div></button>
    <button class="tile wide" style="--c:var(--red)" data-tab="body">${tileIcon('body')}<div><h2>Kilo</h2><p>${bodyTxt}</p></div><span class="go" aria-hidden="true">›</span></button>
  </div>
  ${utilityLinks()}`;
}

/** Ana ekranın altındaki kurulum ve yedekleme satırları. */
function utilityLinks(): string {
  const rows: string[] = [];
  if (canOfferInstall())
    rows.push(
      `<button class="util" data-act="install">${utilIcon('install')}<span><b>Uygulamayı yükle</b><span>Ana ekrandan aç, internetsiz de çalışsın</span></span></button>`,
    );
  const status = backupStatus();
  const sub = isEmpty(summarize())
    ? 'Başka bir cihazdan yedeğini yükle'
    : `<span class="${status.stale ? 'warn' : ''}">${status.text}</span>`;
  rows.push(
    `<button class="util" data-act="data">${utilIcon('backup')}<span><b>Yedekleme ve veriler</b><span>${sub}</span></span></button>`,
  );
  return `<div class="utils">${rows.join('')}</div>`;
}
