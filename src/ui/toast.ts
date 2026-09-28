import { $ } from '../lib/dom.ts';

let timer: ReturnType<typeof setTimeout> | undefined;

/** Kısa bildirim. `highlight` (ör. yeni rekor) daha uzun kalır ve vurgulu görünür. */
export function toast(message: string, highlight = false): void {
  const el = $('#toast');
  el.textContent = message;
  el.classList.toggle('pr', highlight);
  el.classList.add('show');
  clearTimeout(timer);
  timer = setTimeout(() => el.classList.remove('show'), highlight ? 3200 : 1800);
}
