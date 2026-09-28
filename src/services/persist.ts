// Değişiklikleri önce localStorage'a, bulut modundaysa kısa bir gecikmeyle buluta yazar.
// Bulut belgeleri: s-<tarih> (antrenman), f-<tarih> (beslenme), body, settings, nutrition.
// Yazılamayan belgeler (çevrimdışı) "kirli" olarak işaretlenir ve bağlantı gelince flushDirty ile gönderilir.
import { saveLocal, store } from '../state/store.ts';
import type { DateStr } from '../types.ts';
import { clearDirty, dirtyIds, isCloud, writeDoc, writeNow } from './db.ts';

type Timer = ReturnType<typeof setTimeout>;

/** Yazılmayı bekleyen belgeler. Bekleyen belge için gelen bulut güncellemesi yok sayılır. */
export const pending: {
  session: Record<DateStr, Timer>;
  food: Record<DateStr, Timer>;
  body: Timer | null;
  nut: Timer | null;
} = { session: {}, food: {}, body: null, nut: null };

/** Belgenin buluta yazılacak içeriği; belge boşsa null (silinir). Tek doğruluk kaynağı. */
export function docPayload(id: string): object | null {
  if (id.startsWith('s-')) {
    const date = id.slice(2);
    const s = store.sessions[date];
    const has = s && ((s.exercises && s.exercises.length) || s.note);
    return has
      ? { kind: 'session', date, exercises: s.exercises || [], note: s.note || '', updatedAt: Date.now() }
      : null;
  }
  if (id.startsWith('f-')) {
    const date = id.slice(2);
    const d = store.food[date];
    const has = d && (d.items.length || d.water);
    return has ? { kind: 'food', date, items: d.items, water: d.water || 0, updatedAt: Date.now() } : null;
  }
  if (id === 'body') return { kind: 'body', entries: store.body, updatedAt: Date.now() };
  if (id === 'settings')
    return { kind: 'settings', custom: store.custom, templates: store.templates, profile: store.profile };
  if (id === 'nutrition')
    return { kind: 'nutrition', goals: store.goals, custom: store.foodCustom, updatedAt: Date.now() };
  return null;
}

export function persistSession(date: DateStr): void {
  saveLocal();
  if (!isCloud()) return;
  clearTimeout(pending.session[date]);
  pending.session[date] = setTimeout(async () => {
    await writeDoc('s-' + date, docPayload('s-' + date));
    delete pending.session[date];
  }, 450);
}

export function persistSettings(): void {
  saveLocal();
  if (isCloud()) void writeDoc('settings', docPayload('settings'));
}

export function persistBody(): void {
  saveLocal();
  if (!isCloud()) return;
  clearTimeout(pending.body ?? undefined);
  pending.body = setTimeout(async () => {
    await writeDoc('body', docPayload('body'));
    pending.body = null;
  }, 400);
}

export function persistFood(date: DateStr): void {
  saveLocal();
  if (!isCloud()) return;
  clearTimeout(pending.food[date]);
  pending.food[date] = setTimeout(async () => {
    await writeDoc('f-' + date, docPayload('f-' + date));
    delete pending.food[date];
  }, 450);
}

export function persistNut(): void {
  saveLocal();
  if (!isCloud()) return;
  clearTimeout(pending.nut ?? undefined);
  pending.nut = setTimeout(async () => {
    await writeDoc('nutrition', docPayload('nutrition'));
    pending.nut = null;
  }, 400);
}

/**
 * Çevrimdışıyken yazılamayan belgeleri yerel içeriğiyle gönderir. Bulutla birleştirmeden ÖNCE çağrılmalı;
 * yoksa buluttaki eski sürüm yereldeki yeni düzenlemenin üzerine yazar. Başarısız olursa false.
 */
export async function flushDirty(): Promise<boolean> {
  for (const id of dirtyIds()) {
    try {
      await writeNow(id, docPayload(id));
      clearDirty(id);
    } catch {
      return false;
    }
  }
  return true;
}
