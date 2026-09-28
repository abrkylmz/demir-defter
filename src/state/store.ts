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
import type { Store } from '../types.ts';

export const store: Store = {
  sessions: {},
  custom: [],
  templates: [],
  body: {},
  food: {},
  foodCustom: [],
  goals: null,
  profile: {},
};

/** Hesapsız (misafir) verilerin anahtarı. Hesaplı kullanıcılar kendi anahtarlarını kullanır. */
export const GUEST_KEY = 'demirdefter.v1';
let lsKey = GUEST_KEY;

/** Yerel önbelleği bir kullanıcıya bağlar; null misafir moduna döner. */
export function useStorageFor(userId: string | null): void {
  lsKey = userId ? `${GUEST_KEY}:${userId}` : GUEST_KEY;
}

const empty = (): Store => ({
  sessions: {},
  custom: [],
  templates: [],
  body: {},
  food: {},
  foodCustom: [],
  goals: null,
  profile: {},
});

/** Tüm verileri bellekte sıfırlar (çıkışta). */
export function resetStore(): void {
  Object.assign(store, empty());
}

function readKey(key: string): Store | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const p = JSON.parse(raw);
    return {
      sessions: p.sessions || {},
      custom: p.custom || [],
      templates: p.templates || [],
      body: p.body || {},
      food: p.food || {},
      foodCustom: p.foodCustom || [],
      goals: p.goals || null,
      profile: p.profile || {},
    };
  } catch {
    // bozuk ya da erişilemeyen depolama
    return null;
  }
}

export function loadLocal(): void {
  Object.assign(store, readKey(lsKey) || empty());
}

export function saveLocal(): void {
  try {
    localStorage.setItem(lsKey, JSON.stringify(store));
  } catch {
    // gizli sekme ya da kota dolu: sessizce geç
  }
}

/**
 * Bu cihazdaki misafir verisini hesaba taşımak için alır ve cihazdan siler.
 * Böylece aynı cihazda sonra giriş yapan başka biri bu verileri görmez.
 */
export function takeGuestData(): Store | null {
  const data = readKey(GUEST_KEY);
  try {
    localStorage.removeItem(GUEST_KEY);
  } catch {
    // depolama kapalı
  }
  return data;
}

/** Çıkışta bu kullanıcının yerel önbelleğini siler. */
export function clearLocal(): void {
  try {
    localStorage.removeItem(lsKey);
  } catch {
    // depolama kapalı
  }
}
