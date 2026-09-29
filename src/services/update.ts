// Uygulama güncellemeleri: yeni sürüm yayınlanınca kullanıcı eski önbellekte takılı kalmasın.
// Servis çalışanı (vite-plugin-pwa, autoUpdate) yeni sürümü indirip hemen devreye alır; sayfa da kendini yeniler.
// Alt panel açıksa (ör. set girilirken) yenileme panel kapanana kadar bekler. Veriler her değişiklikte
// kaydedildiği için yenilemede kayıp olmaz.
import { ui } from '../state/ui.ts';
import { toast } from '../ui/toast.ts';

const UPDATED_FLAG = 'demirdefter.updated';
let reloadPending = false;

function reloadWhenIdle(): void {
  if (reloadPending) return;
  reloadPending = true;
  const tryReload = () => {
    if (ui.sheetOpen) return setTimeout(tryReload, 1000);
    try {
      sessionStorage.setItem(UPDATED_FLAG, '1');
    } catch {
      // depolama kapalı: bildirim gösterilmez, yenileme yine olur
    }
    location.reload();
  };
  tryReload();
}

export function initUpdates(): void {
  // Yenilemeden sonra bir kez bildir
  try {
    if (sessionStorage.getItem(UPDATED_FLAG)) {
      sessionStorage.removeItem(UPDATED_FLAG);
      setTimeout(() => toast('Uygulama güncellendi'), 600);
    }
  } catch {
    // depolama kapalı
  }

  if (!('serviceWorker' in navigator) || import.meta.env.DEV) return;
  // İlk kurulumda sayfayı kontrol eden servis çalışanı yoktur; o ilk "controllerchange" bir güncelleme değildir.
  // Sonraki her değişim (aynı oturumda gelenler dahil) yeni sürümdür.
  let controlled = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (controlled) reloadWhenIdle();
    controlled = true;
  });

  navigator.serviceWorker
    .register('/sw.js', { scope: '/' })
    .then(reg => {
      // Uygulama öne geldiğinde ve açıkken saatte bir yeni sürüm var mı bak
      const check = () => void reg.update().catch(() => {});
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') check();
      });
      setInterval(check, 60 * 60 * 1000);
    })
    .catch(() => {
      // servis çalışanı kaydedilemedi: uygulama çevrimiçi çalışmaya devam eder
    });
}
