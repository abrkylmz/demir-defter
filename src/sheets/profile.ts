import { DEFAULT_WEEKLY_GOAL } from '../domain/weekly.ts';
import { closest, data, esc, q, qa } from '../lib/dom.ts';
import { logout, showSignIn, signedInUser } from '../services/account.ts';
import { persistSettings } from '../services/persist.ts';
import { authEnabled } from '../services/supabase.ts';
import { store } from '../state/store.ts';
import { closeSheet, openSheet } from '../ui/sheet.ts';
import { toast } from '../ui/toast.ts';

const GOALS = [2, 3, 4, 5, 6];

/** Hesap bilgisi ve çıkış (ya da misafirse giriş). Hesap sistemi kapalıysa boş. */
function accountSection(): string {
  if (!authEnabled()) return '';
  const u = signedInUser();
  if (u)
    return `<div class="account"><span class="account-label">Hesap</span><span class="account-mail">${esc(u.email || '')}</span>
      <button class="btn danger" id="pLogout" style="width:100%;margin-top:10px">Çıkış yap</button></div>`;
  return `<div class="account"><span class="account-label">Hesapsız kullanıyorsun</span>
    <span class="account-mail">Hesap açarsan verilerin tüm cihazlarında olur.</span>
    <button class="btn" id="pSignIn" style="width:100%;margin-top:10px">Giriş yap ya da hesap oluştur</button></div>`;
}

/** Ad (selamlama için) ve haftalık antrenman hedefi. */
export function openProfile(): void {
  const p = store.profile;
  let goal = p.weeklyGoal || DEFAULT_WEEKLY_GOAL;
  openSheet(
    `<h2>Profilim</h2><div class="sub">Ana ekran seni adınla karşılar, haftalık hedefini takip eder.</div>
    <div class="field"><label for="pName">Adın</label>
      <input id="pName" class="search" style="margin-top:0" maxlength="40" autocomplete="given-name" autocapitalize="words" value="${esc(p.name || '')}" placeholder="Örn. Ahmet"></div>
    <div class="field"><label>Haftada kaç gün antrenman hedefliyorsun?</label>
      <div class="chips" id="pGoal">${GOALS.map(g => `<button type="button" class="chip" data-g="${g}" aria-pressed="${g === goal}">${g} gün</button>`).join('')}</div></div>
    <div class="sheetactions"><button class="btn primary grow" id="pSave">Kaydet</button></div>
    ${accountSection()}`,
    sh => {
      const name = q<HTMLInputElement>(sh, '#pName');
      q(sh, '#pGoal').addEventListener('click', ev => {
        const b = closest(ev.target, '[data-g]');
        if (!b) return;
        goal = Number(data(b, 'g'));
        qa(sh, '[data-g]').forEach(c => c.setAttribute('aria-pressed', String(c === b)));
      });
      const save = () => {
        const n = name.value.trim().slice(0, 40);
        store.profile = { ...store.profile, weeklyGoal: goal, ...(n ? { name: n } : {}) };
        if (!n) delete store.profile.name;
        persistSettings();
        closeSheet();
        toast(n ? `Kaydedildi, ${n}` : 'Kaydedildi');
      };
      q(sh, '#pSave').addEventListener('click', save);
      name.addEventListener('keydown', e => {
        if (e.key === 'Enter') save();
      });
      sh.querySelector('#pLogout')?.addEventListener('click', ev => {
        const b = ev.currentTarget as HTMLButtonElement;
        if (!b.dataset.confirm) {
          b.dataset.confirm = '1';
          b.textContent = 'Çıkmak için tekrar dokun';
          return;
        }
        closeSheet();
        void logout();
      });
      sh.querySelector('#pSignIn')?.addEventListener('click', () => {
        closeSheet();
        showSignIn();
      });
      if (!p.name) setTimeout(() => name.focus({ preventScroll: true }), 50);
    },
  );
}
