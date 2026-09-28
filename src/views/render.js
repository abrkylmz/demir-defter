import { $ } from '../lib/dom.js';
import { ui } from '../state/ui.js';
import { renderBody } from './body.js';
import { renderFood } from './food.js';
import { renderHistory } from './history.js';
import { renderHome } from './home.js';
import { renderLog } from './log.js';
import { renderProgress } from './progress.js';

const VIEWS = {
  home: renderHome,
  log: renderLog,
  food: renderFood,
  history: renderHistory,
  progress: renderProgress,
  body: renderBody,
};

/** Aktif sekmeyi baştan çizer. Durum değiştiren her işlemden sonra çağrılır. */
export function render() {
  document
    .querySelectorAll('nav.tabs button')
    .forEach(b => b.setAttribute('aria-current', b.dataset.tab === ui.tab ? 'page' : 'false'));
  const home = ui.tab === 'home';
  document.body.classList.toggle('home', home);
  $('#sync').hidden = !home;
  $('#homeBtn').hidden = home;
  $('#view').innerHTML = (VIEWS[ui.tab] || renderBody)();
  if (ui.tab === 'food') ui.justOpened = false;
}
