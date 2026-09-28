import './styles/index.css';
import { bindEvents } from './events.ts';
import { initAccount } from './services/account.ts';
import { initInstall } from './services/install.ts';
import { initCloud } from './services/sync.ts';
import { isTab, ui } from './state/ui.ts';
import { initSheet } from './ui/sheet.ts';
import { render } from './views/render.ts';

/** Ana ekran kısayolları (?tab=log gibi) doğrudan ilgili sekmeyi açar. */
function applyStartTab(): void {
  const tab = new URLSearchParams(location.search).get('tab');
  if (!isTab(tab)) return;
  ui.tab = tab;
  history.replaceState(null, '', location.pathname);
}

applyStartTab();
initSheet();
bindEvents();
initInstall(() => {
  if (ui.tab === 'home' && !ui.sheetOpen) render();
});
// Oturum (varsa) yerel önbellekten okunur; ilk çizim doğru kullanıcının verisiyle yapılır.
void initAccount().then(() => {
  render();
  void initCloud();
});
