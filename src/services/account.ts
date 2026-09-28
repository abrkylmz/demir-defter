// Hesap akışları: açılış, giriş/kayıt formu, hesapsız devam, çıkış ve şifre yenileme.
// Sunucu: /api/auth (Vercel Functions + Neon). API yoksa uygulama hesapsız yerel modda çalışır.
import { q } from '../lib/dom.ts';
import { loadLocal } from '../state/store.ts';
import { ui } from '../state/ui.ts';
import { toast } from '../ui/toast.ts';
import { render } from '../views/render.ts';
import {
  authErrorText,
  authStatus,
  requestPasswordReset,
  resetPassword,
  signIn,
  signOut,
  signUp,
  type AccountUser,
} from './api.ts';
import { writesSettled } from './db.ts';
import { startAccountSync, stopAccountSync } from './sync.ts';

const GUEST_FLAG = 'demirdefter.guest';
/** Son giriş yapan kullanıcı: çevrimdışı açılışta verisini gösterebilmek için. */
const USER_CACHE = 'demirdefter.user';
export const MIN_PASSWORD = 8;

let available = false;
let resetEnabled = false;
let user: AccountUser | null = null;
let resetToken: string | null = null;

export const authEnabled = (): boolean => available;
export const passwordResetEnabled = (): boolean => resetEnabled;
export const signedInUser = (): AccountUser | null => user;

function storage<T>(key: string): T | null {
  try {
    const v = localStorage.getItem(key);
    return v ? (JSON.parse(v) as T) : null;
  } catch {
    return null;
  }
}
function setStorage(key: string, v: unknown): void {
  try {
    if (v === null) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(v));
  } catch {
    // depolama kapalı
  }
}

async function activate(u: AccountUser): Promise<void> {
  if (user?.id === u.id) return;
  user = u;
  setStorage(USER_CACHE, u);
  setStorage(GUEST_FLAG, null);
  ui.authMode = null;
  await startAccountSync(u);
}

/** Sıfırlama bağlantısıyla gelindiyse (?reset=…) belirteci URL'den alır. */
function takeResetToken(): string | null {
  const params = new URLSearchParams(location.search);
  const t = params.get('reset');
  if (!t) return null;
  params.delete('reset');
  const rest = params.toString();
  history.replaceState(null, '', location.pathname + (rest ? `?${rest}` : ''));
  return t;
}

/** Açılışta çağrılır. */
export async function initAccount(): Promise<void> {
  loadLocal();
  resetToken = takeResetToken();
  try {
    const s = await authStatus();
    available = s.available;
    resetEnabled = s.reset;
    if (!available) return;
    if (resetToken) ui.authMode = 'newpass';
    else if (s.user) await activate(s.user);
    else {
      setStorage(USER_CACHE, null);
      if (!storage<string>(GUEST_FLAG)) ui.authMode = 'signin';
    }
  } catch {
    // Çevrimdışı: son kullanıcı varsa onun önbelleğiyle aç; değişiklikler bağlantı gelince gönderilir.
    const cached = storage<AccountUser>(USER_CACHE);
    if (cached) {
      available = true;
      await activate(cached);
    }
  }

  // Oturum sunucuda sona erdiyse: veriyi silmeden giriş ekranına dön (gönderilmemiş düzenlemeler korunur).
  window.addEventListener('dd:unauthorized', () => {
    if (!user) return;
    user = null;
    stopAccountSync({ keepCache: true });
    ui.authMode = 'signin';
    render();
    toast('Oturumun sona erdi, tekrar giriş yap.');
  });
}

/** Giriş ekranındaki form gönderimi. */
export async function submitAuthForm(form: HTMLFormElement): Promise<void> {
  const mode = form.dataset.mode;
  const err = q(form, '#aError');
  const button = q<HTMLButtonElement>(form, 'button[type="submit"]');
  const val = (id: string) => form.querySelector<HTMLInputElement>(id)?.value.trim() ?? '';
  const email = val('#aEmail');
  const password = form.querySelector<HTMLInputElement>('#aPass')?.value ?? '';
  const name = val('#aName');

  const fail = (text: string, focus?: string) => {
    err.textContent = text;
    if (focus) form.querySelector<HTMLInputElement>(focus)?.focus();
  };
  if (mode === 'signup' && !name) return fail('Adını yaz, seni adınla karşılayalım.', '#aName');
  if (mode !== 'newpass' && !/^\S+@\S+\.\S+$/.test(email)) return fail('Geçerli bir e-posta gir.', '#aEmail');
  if ((mode === 'signup' || mode === 'newpass') && password.length < MIN_PASSWORD)
    return fail(`Şifre en az ${MIN_PASSWORD} karakter olmalı.`, '#aPass');
  if (mode === 'signin' && !password) return fail('Şifreni gir.', '#aPass');

  err.textContent = '';
  button.disabled = true;
  const original = button.textContent;
  button.textContent = 'Bekle…';
  try {
    if (mode === 'reset') {
      await requestPasswordReset(email);
      ui.authMode = 'sent';
      ui.authInfo = `${email} adresine kayıtlı bir hesap varsa şifre yenileme bağlantısı gönderdik. Bağlantı 1 saat geçerli.`;
      render();
      return;
    }
    const u =
      mode === 'signup'
        ? await signUp(name, email, password)
        : mode === 'newpass'
          ? await resetPassword(resetToken || '', password)
          : await signIn(email, password);
    resetToken = null;
    await activate(u);
    render();
    toast(
      mode === 'signup'
        ? `Hoş geldin, ${u.name}`
        : mode === 'newpass'
          ? 'Şifren güncellendi'
          : 'Tekrar hoş geldin',
    );
  } catch (e) {
    fail(authErrorText(e));
  } finally {
    if (document.contains(button)) {
      button.disabled = false;
      button.textContent = original;
    }
  }
}

/** Hesap açmadan yerel modda devam. */
export function continueAsGuest(): void {
  setStorage(GUEST_FLAG, '1');
  ui.authMode = null;
  render();
}

/** Misafirken giriş ekranını açar. */
export function showSignIn(): void {
  ui.authMode = 'signin';
  render();
}

/** Çıkış: bekleyen yazmalar tamamlanır, bu kullanıcının verisi cihazdan silinir. */
export async function logout(): Promise<void> {
  // persist* 450 ms gecikmeyle yazar; son değişiklik kaybolmasın
  await new Promise(r => setTimeout(r, 600));
  await writesSettled();
  await signOut().catch(() => {});
  user = null;
  setStorage(USER_CACHE, null);
  stopAccountSync({ keepCache: false });
  ui.authMode = 'signin';
  ui.tab = 'home';
  render();
  toast('Çıkış yapıldı');
}
