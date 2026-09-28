import { DEFAULT_WEEKLY_GOAL } from '../domain/weekly.ts';
import { closest, data, esc, q, qa } from '../lib/dom.ts';
import { persistSettings } from '../services/persist.ts';
import { store } from '../state/store.ts';
import { closeSheet, openSheet } from '../ui/sheet.ts';
import { toast } from '../ui/toast.ts';

const GOALS = [2, 3, 4, 5, 6];

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
    <div class="sheetactions"><button class="btn primary grow" id="pSave">Kaydet</button></div>`,
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
      if (!p.name) setTimeout(() => name.focus({ preventScroll: true }), 50);
    },
  );
}
