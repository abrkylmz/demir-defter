import './styles/index.css';
import { bindEvents } from './events.js';
import { initInstall } from './services/install.js';
import { initCloud } from './services/sync.js';
import { loadLocal } from './state/store.js';
import { ui } from './state/ui.js';
import { initSheet } from './ui/sheet.js';
import { render } from './views/render.js';

const TABS = ['home', 'log', 'food', 'history', 'progress', 'body'];

/** Ana ekran kısayolları (?tab=log gibi) doğrudan ilgili sekmeyi açar. */
function applyStartTab() {
  const tab = new URLSearchParams(location.search).get('tab');
  if (!TABS.includes(tab)) return;
  ui.tab = tab;
  history.replaceState(null, '', location.pathname);
}

loadLocal();
applyStartTab();
initSheet();
bindEvents();
initInstall(() => {
  if (ui.tab === 'home' && !ui.sheetOpen) render();
});
render();
initCloud();
