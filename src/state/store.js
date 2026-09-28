/**
 * Uygulamanın tek veri kaynağı. Tüm ekranlar buradan okur, değişiklikler services/persist.js ile kaydedilir.
 *
 * sessions[YYYY-MM-DD] = {date, note?, exercises:[{id, name, group, bar, note?, sets:[{kg, reps}]}]}
 * custom      = [{name, group, bar}]                         kullanıcının eklediği hareketler
 * templates   = [{id, name, exercises:[{name, group, bar}]}] antrenman şablonları
 * body[YYYY-MM-DD] = kg
 * food[YYYY-MM-DD] = {items:[{id, name, meal, g, per:{k,p,c,f}, pl, pg}], water}
 * foodCustom  = [{name, k, p, c, f, pl, pg}]
 * goals       = {kcal, p, c, f, water, profile} | null
 */
export const store = {
  sessions: {},
  custom: [],
  templates: [],
  body: {},
  food: {},
  foodCustom: [],
  goals: null,
};

const LS_KEY = 'demirdefter.v1';

export function loadLocal() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return;
    const p = JSON.parse(raw);
    store.sessions = p.sessions || {};
    store.custom = p.custom || [];
    store.templates = p.templates || [];
    store.body = p.body || {};
    store.food = p.food || {};
    store.foodCustom = p.foodCustom || [];
    store.goals = p.goals || null;
  } catch {
    // bozuk ya da erişilemeyen depolama: boş verilerle devam
  }
}

export function saveLocal() {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(store));
  } catch {
    // gizli sekme ya da kota dolu: sessizce geç
  }
}
