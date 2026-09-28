// Alttan açılan panel. Aynı anda tek panel açık olur; yeni panel açmak içeriği değiştirir.
// Panel kapanınca ana görünüm yeniden çizilir.
import { $ } from '../lib/dom.js';
import { ui } from '../state/ui.js';
import { render } from '../views/render.js';

let lastFocus = null;

/**
 * @param {string} html panel içeriği
 * @param {(sheet: HTMLElement) => void} [onReady] olay dinleyicilerini bağlamak için.
 *   Dinleyicileri panelin içindeki öğelere bağla; #sheet öğesinin kendisi tekrar kullanılıyor.
 */
export function openSheet(html, onReady) {
  lastFocus = document.activeElement;
  const sheet = $('#sheet');
  const scrim = $('#scrim');
  sheet.innerHTML = '<div class="grab"></div>' + html;
  sheet.hidden = false;
  scrim.hidden = false;
  ui.sheetOpen = true;
  requestAnimationFrame(() => {
    sheet.classList.add('show');
    scrim.classList.add('show');
  });
  if (onReady) onReady(sheet);
}

export function closeSheet() {
  const sheet = $('#sheet');
  const scrim = $('#scrim');
  sheet.classList.remove('show');
  scrim.classList.remove('show');
  ui.sheetOpen = false;
  setTimeout(() => {
    if (ui.sheetOpen) return;
    sheet.hidden = true;
    scrim.hidden = true;
    sheet.innerHTML = '';
  }, 260);
  render();
  if (lastFocus && document.contains(lastFocus)) lastFocus.focus();
}

export function initSheet() {
  $('#scrim').addEventListener('click', closeSheet);
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && ui.sheetOpen) closeSheet();
  });
}
