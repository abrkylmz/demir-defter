// Değişiklikleri önce localStorage'a, bulut modundaysa kısa bir gecikmeyle buluta yazar.
// Bulut belgeleri: s-<tarih> (antrenman), f-<tarih> (beslenme), body, settings, nutrition.
import { saveLocal, store } from '../state/store.js';
import { isCloud, writeDoc } from './db.js';

/** Yazılmayı bekleyen belgeler. Bekleyen belge için gelen bulut güncellemesi yok sayılır. */
export const pending = { session: {}, food: {}, body: null, nut: null };

export function persistSession(date) {
  saveLocal();
  if (!isCloud()) return;
  clearTimeout(pending.session[date]);
  pending.session[date] = setTimeout(async () => {
    const s = store.sessions[date];
    const has = s && ((s.exercises && s.exercises.length) || s.note);
    await writeDoc(
      's-' + date,
      has
        ? { kind: 'session', date, exercises: s.exercises || [], note: s.note || '', updatedAt: Date.now() }
        : null,
    );
    delete pending.session[date];
  }, 450);
}

export function persistSettings() {
  saveLocal();
  if (isCloud()) writeDoc('settings', { kind: 'settings', custom: store.custom, templates: store.templates });
}

export function persistBody() {
  saveLocal();
  if (!isCloud()) return;
  clearTimeout(pending.body);
  pending.body = setTimeout(async () => {
    await writeDoc('body', { kind: 'body', entries: store.body, updatedAt: Date.now() });
    pending.body = null;
  }, 400);
}

export function persistFood(date) {
  saveLocal();
  if (!isCloud()) return;
  clearTimeout(pending.food[date]);
  pending.food[date] = setTimeout(async () => {
    const d = store.food[date];
    const has = d && (d.items.length || d.water);
    await writeDoc(
      'f-' + date,
      has ? { kind: 'food', date, items: d.items, water: d.water || 0, updatedAt: Date.now() } : null,
    );
    delete pending.food[date];
  }, 450);
}

export function persistNut() {
  saveLocal();
  if (!isCloud()) return;
  clearTimeout(pending.nut);
  pending.nut = setTimeout(async () => {
    await writeDoc('nutrition', {
      kind: 'nutrition',
      goals: store.goals,
      custom: store.foodCustom,
      updatedAt: Date.now(),
    });
    pending.nut = null;
  }, 400);
}
