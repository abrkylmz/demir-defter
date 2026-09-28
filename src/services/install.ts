// PWA kurulumu: Chrome/Edge/Android'de tarayıcının kurulum penceresi, iOS'ta elle "Ana Ekrana Ekle".

let deferredPrompt: BeforeInstallPromptEvent | null = null;

export const isStandalone = () =>
  matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;

export const isIOS = () =>
  /iphone|ipad|ipod/i.test(navigator.userAgent) ||
  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

/** Kurulum önerisi gösterilmeli mi: tarayıcı kurulum sunuyor ya da iOS Safari'deyiz. */
export const canOfferInstall = () => !isStandalone() && (!!deferredPrompt || isIOS());

/** Tarayıcının kurulum penceresini açar; iOS'ta false döner (talimat gösterilmeli). */
export async function promptInstall() {
  if (!deferredPrompt) return false;
  const e = deferredPrompt;
  deferredPrompt = null;
  await e.prompt();
  await e.userChoice;
  return true;
}

/** @param {() => void} onChange kurulum durumu değişince (ör. yeniden çizmek için) */
export function initInstall(onChange: () => void): void {
  window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault();
    deferredPrompt = e;
    onChange();
  });
  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    onChange();
  });
}
