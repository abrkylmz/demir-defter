// Hesap akışları: açılış, giriş/kayıt formu, hesapsız devam, çıkış ve şifre yenileme.
import type { User } from '@supabase/supabase-js';
import { q } from '../lib/dom.ts';
import { loadLocal } from '../state/store.ts';
import { ui } from '../state/ui.ts';
import { closeSheet, openSheet } from '../ui/sheet.ts';
import { toast } from '../ui/toast.ts';
import { render } from '../views/render.ts';
import { writesSettled } from './db.ts';
import {
  authEnabled,
  currentUser,
  sendPasswordReset,
  signIn,
  signOut,
  signUp,
  supabase,
  updatePassword,
} from './supabase.ts';
import { startAccountSync, stopAccountSync } from './sync.ts';

const GUEST_FLAG = 'demirdefter.guest';
const MIN_PASSWORD = 8;

let user: User | null = null;

export const signedInUser = (): User | null => user;

const guestChosen = (): boolean => {
  try {
    return localStorage.getItem(GUEST_FLAG) === '1';
  } catch {
    return false;
  }
};
const setGuest = (on: boolean) => {
  try {
    if (on) localStorage.setItem(GUEST_FLAG, '1');
    else localStorage.removeItem(GUEST_FLAG);
  } catch {
    // depolama kapalı
  }
};

async function activate(u: User): Promise<void> {
  if (user?.id === u.id) return;
  user = u;
  setGuest(false);
  ui.authMode = null;
  ui.tab = 'home';
  await startAccountSync(u);
}

/** Açılışta çağrılır. Hesap sistemi kapalıysa yalnızca yerel veriyi yükler. */
export async function initAccount(): Promise<void> {
  loadLocal();
  if (!authEnabled()) return;
  const u = await currentUser().catch(() => null);
  if (u) await activate(u);
  else if (!guestChosen()) ui.authMode = 'signin';

  supabase().auth.onAuthStateChange((event, session) => {
    // Supabase dinleyici içinde başka auth çağrısı yapılmamalı; işi sıradaki tura bırak.
    setTimeout(() => {
      if (event === 'PASSWORD_RECOVERY') openNewPassword();
      else if (event === 'SIGNED_IN' && session?.user) void activate(session.user).then(render);
    }, 0);
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
  if (!/^\S+@\S+\.\S+$/.test(email)) return fail('Geçerli bir e-posta gir.', '#aEmail');
  if (mode !== 'reset' && password.length < (mode === 'signup' ? MIN_PASSWORD : 1))
    return fail(
      mode === 'signup' ? `Şifre en az ${MIN_PASSWORD} karakter olmalı.` : 'Şifreni gir.',
      '#aPass',
    );

  err.textContent = '';
  button.disabled = true;
  const original = button.textContent;
  button.textContent = 'Bekle…';
  try {
    if (mode === 'reset') {
      const r = await sendPasswordReset(email);
      if (!r.ok) return fail(r.error);
      ui.authMode = 'sent';
      ui.authInfo = `${email} adresine şifre yenileme bağlantısı gönderdik. Bağlantıya tıklayınca yeni şifreni belirleyebilirsin.`;
      render();
      return;
    }
    const r = mode === 'signup' ? await signUp(name, email, password) : await signIn(email, password);
    if (!r.ok) return fail(r.error);
    if (r.needsConfirmation) {
      ui.authMode = 'sent';
      ui.authInfo = `${email} adresine bir onay bağlantısı gönderdik. Onayladıktan sonra buradan giriş yapabilirsin.`;
      render();
      return;
    }
    const u = await currentUser();
    if (u) {
      await activate(u);
      render();
      toast(mode === 'signup' ? 'Hesabın oluşturuldu' : 'Hoş geldin');
    }
  } finally {
    if (document.contains(button)) {
      button.disabled = false;
      button.textContent = original;
    }
  }
}

/** Hesap açmadan yerel modda devam. */
export function continueAsGuest(): void {
  setGuest(true);
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
  stopAccountSync();
  ui.authMode = 'signin';
  ui.tab = 'home';
  render();
  toast('Çıkış yapıldı');
}

/** Şifre yenileme bağlantısından dönüldüğünde yeni şifre sorulur. */
function openNewPassword(): void {
  openSheet(
    `<h2>Yeni şifre</h2><div class="sub">Hesabın için yeni bir şifre belirle.</div>
    <form id="npForm" novalidate>
      <div class="field"><label for="npPass">Yeni şifre</label><input id="npPass" class="search" style="margin-top:0" type="password" autocomplete="new-password" minlength="${MIN_PASSWORD}" required></div>
      <p class="auth-error" role="alert" id="npError"></p>
      <div class="sheetactions"><button class="btn primary grow" type="submit">Kaydet</button></div>
    </form>`,
    sh => {
      const form = q<HTMLFormElement>(sh, '#npForm');
      form.addEventListener('submit', async ev => {
        ev.preventDefault();
        const pass = q<HTMLInputElement>(form, '#npPass').value;
        const err = q(form, '#npError');
        if (pass.length < MIN_PASSWORD) {
          err.textContent = `Şifre en az ${MIN_PASSWORD} karakter olmalı.`;
          return;
        }
        const r = await updatePassword(pass);
        if (!r.ok) {
          err.textContent = r.error;
          return;
        }
        closeSheet();
        toast('Şifren güncellendi');
      });
    },
  );
}
