let timer = null;

/** Kısa bildirim. `highlight` (ör. yeni rekor) daha uzun kalır ve vurgulu görünür. */
export function toast(message, highlight = false) {
  const el = document.getElementById('toast');
  el.textContent = message;
  el.classList.toggle('pr', highlight);
  el.classList.add('show');
  clearTimeout(timer);
  timer = setTimeout(() => el.classList.remove('show'), highlight ? 3200 : 1800);
}
