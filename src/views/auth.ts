// Giriş / kayıt ekranı. Yalnızca sunucuda hesap sistemi (veritabanı) varsa ve kullanıcı hesapsız devam etmeyi seçmediyse görünür.
import { esc } from '../lib/dom.ts';
import { passwordResetEnabled } from '../services/account.ts';
import { ui } from '../state/ui.ts';

export type AuthMode = 'signin' | 'signup' | 'reset' | 'sent' | 'newpass';

const LOGO = `<svg width="64" height="48" viewBox="0 0 30 22" aria-hidden="true"><rect x="0" y="9.5" width="30" height="3" rx="1.5" fill="var(--bar)"/><rect x="4" y="2" width="4" height="18" rx="1.5" fill="var(--red)"/><rect x="8.5" y="4" width="3" height="14" rx="1.2" fill="var(--blue)"/><rect x="22" y="2" width="4" height="18" rx="1.5" fill="var(--red)"/><rect x="18.5" y="4" width="3" height="14" rx="1.2" fill="var(--blue)"/></svg>`;

const field = (id: string, label: string, type: string, auto: string, extra = '') =>
  `<div class="field"><label for="${id}">${label}</label><input id="${id}" name="${id}" class="search" style="margin-top:0" type="${type}" autocomplete="${auto}" required ${extra}></div>`;

export function renderAuth(): string {
  const mode = ui.authMode;
  const tab = (m: AuthMode, label: string) =>
    `<button type="button" class="seg" role="tab" data-act="authmode" data-v="${m}" aria-selected="${mode === m}">${label}</button>`;

  let body: string;
  if (mode === 'sent') {
    body = `<div class="auth-note" role="status"><b>E-postanı kontrol et</b>
      <p>${esc(ui.authInfo)}</p></div>
      <button type="button" class="btn primary" style="width:100%" data-act="authmode" data-v="signin">Giriş ekranına dön</button>`;
  } else if (mode === 'newpass') {
    body = `<form id="authForm" data-mode="newpass" novalidate>
        <p class="hint">Hesabın için yeni bir şifre belirle.</p>
        ${field('aPass', 'Yeni şifre', 'password', 'new-password', 'minlength="8"')}
        <p class="hint">En az 8 karakter.</p>
        <p class="auth-error" role="alert" id="aError"></p>
        <button class="btn primary" style="width:100%" type="submit">Şifreyi kaydet ve giriş yap</button>
      </form>`;
  } else if (mode === 'reset') {
    body = `<form id="authForm" data-mode="reset" novalidate>
        <p class="hint">E-posta adresini gir, şifreni yenilemen için bir bağlantı gönderelim.</p>
        ${field('aEmail', 'E-posta', 'email', 'email', 'inputmode="email"')}
        <p class="auth-error" role="alert" id="aError"></p>
        <button class="btn primary" style="width:100%" type="submit">Bağlantı gönder</button>
      </form>
      <button type="button" class="textbtn" data-act="authmode" data-v="signin">Giriş yap'a dön</button>`;
  } else {
    const signup = mode === 'signup';
    body = `<div class="segs" role="tablist" aria-label="Hesap">${tab('signin', 'Giriş yap')}${tab('signup', 'Hesap oluştur')}</div>
      <form id="authForm" data-mode="${mode}" novalidate>
        ${signup ? field('aName', 'Adın', 'text', 'given-name', 'maxlength="40" autocapitalize="words" placeholder="Örn. Ahmet"') : ''}
        ${field('aEmail', 'E-posta', 'email', 'email', 'inputmode="email"')}
        ${field('aPass', 'Şifre', 'password', signup ? 'new-password' : 'current-password', 'minlength="8"')}
        ${signup ? '<p class="hint">En az 8 karakter.</p>' : ''}
        <p class="auth-error" role="alert" id="aError"></p>
        <button class="btn primary" style="width:100%" type="submit">${signup ? 'Hesap oluştur' : 'Giriş yap'}</button>
      </form>
      ${!signup && passwordResetEnabled() ? '<button type="button" class="textbtn" data-act="authmode" data-v="reset">Şifremi unuttum</button>' : ''}`;
  }

  return `<section class="auth" aria-labelledby="authTitle">
    <div class="auth-brand">${LOGO}<h1 id="authTitle">Demir Defter</h1>
      <p>Antrenmanın, beslenmen ve kilon; her cihazda seninle.</p></div>
    <div class="auth-card">${body}</div>
    <button type="button" class="textbtn auth-guest" data-act="guest">Hesapsız devam et</button>
    <p class="auth-foot">Hesapsız kullanımda veriler yalnızca bu cihazda kalır. Sonradan hesap açarsan hesabına taşınır.</p>
  </section>`;
}
