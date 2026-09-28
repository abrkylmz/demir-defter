import { $, qa } from '../lib/dom.ts';
import type { Tab } from '../types.ts';
import { ui } from '../state/ui.ts';
import { isCloud } from '../services/db.ts';
import { renderAuth } from './auth.ts';
import { renderBody } from './body.ts';
import { renderFood } from './food.ts';
import { renderHistory } from './history.ts';
import { renderHome } from './home.ts';
import { renderLog } from './log.ts';
import { renderProgress } from './progress.ts';

const VIEWS: Record<Tab, () => string> = {
  home: renderHome,
  log: renderLog,
  food: renderFood,
  history: renderHistory,
  progress: renderProgress,
  body: renderBody,
};

/** Aktif sekmeyi baştan çizer. Durum değiştiren her işlemden sonra çağrılır. */
export function render(): void {
  // Giriş ekranı: sekmeler ve başlık gizli
  const auth = ui.authMode !== null;
  document.body.classList.toggle('auth-mode', auth);
  if (auth) {
    $('#view').innerHTML = renderAuth();
    return;
  }
  qa(document, 'nav.tabs button').forEach(b =>
    b.setAttribute('aria-current', b.dataset.tab === ui.tab ? 'page' : 'false'),
  );
  const home = ui.tab === 'home';
  document.body.classList.toggle('home', home);
  const sync = $('#sync');
  sync.hidden = !home;
  sync.textContent = isCloud() ? 'Hesabına kayıtlı' : 'Bu cihazda kayıtlı';
  $('#homeBtn').hidden = home;
  $('#view').innerHTML = (VIEWS[ui.tab] || renderBody)();
  if (ui.tab === 'food') ui.justOpened = false;
}
