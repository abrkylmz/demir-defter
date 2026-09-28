// claude.ai bulut senkronu: ilk yüklemede yerel ve bulut verilerini birleştirir, sonra canlı güncellemeleri dinler.
// window.claude yoksa (yerel geliştirme, Vercel) hiçbir şey yapmaz ve uygulama localStorage ile çalışır.
import { $ } from '../lib/dom.ts';
import { clone, nameKey, uid8 } from '../lib/format.ts';
import {
  clearLocal,
  loadLocal,
  resetStore,
  saveLocal,
  store,
  takeGuestData,
  useStorageFor,
} from '../state/store.ts';
import { ui } from '../state/ui.ts';
import { render } from '../views/render.ts';
import { clearAllDirty, cloud, collection } from './db.ts';
import { apiDb, ApiError, type AccountUser } from './api.ts';
import {
  flushDirty,
  pending,
  persistBody,
  persistFood,
  persistNut,
  persistSession,
  persistSettings,
} from './persist.ts';
import type {
  CustomFood,
  DateStr,
  Exercise,
  ExerciseInfo,
  FoodDay,
  FoodItem,
  Goals,
  Session,
  Store,
  Profile,
  Template,
} from '../types.ts';

/** Bulut belgelerinin olası alanları (belge türüne göre bir kısmı dolu). Kendi hesabımızdan gelir. */
interface RemoteDoc {
  kind?: 'session' | 'food' | 'body' | 'settings' | 'nutrition';
  date?: DateStr;
  exercises?: Partial<Exercise>[];
  note?: string;
  items?: FoodItem[];
  water?: number;
  entries?: Record<DateStr, number>;
  custom?: ExerciseInfo[] & CustomFood[];
  templates?: Template[];
  profile?: Profile;
  goals?: Goals | null;
}

const readDoc = (doc: CloudDoc): RemoteDoc | null => clone(doc.data() as RemoteDoc | null);

function sessionFromDoc(v: RemoteDoc, date: DateStr): Session {
  const s: Session = {
    date,
    exercises: (v.exercises || []).map(x => {
      x.id = x.id || uid8();
      x.sets = x.sets || [];
      return x as Exercise;
    }),
  };
  if (v.note) s.note = v.note;
  return s;
}

const hasSessionContent = (s: Session) => (s.exercises || []).length || s.note;

export async function initCloud(): Promise<void> {
  if (!window.claude || typeof window.claude.use !== 'function') return;
  try {
    cloud.downloads = await window.claude.use('downloads');
    if (cloud.downloads) render();
  } catch {
    // indirme izni yok: CSV düğmesi gizli kalır
  }
  try {
    const [d, u] = await Promise.all([window.claude.use('db'), window.claude.use('user')]);
    if (!d || !u) return;
    const id = await u.id();
    if (!id) return;
    cloud.db = d;
    cloud.userId = id;
    await mergeInitial();
    $('#sync').textContent = 'Hesabına kayıtlı';
    render();
    collection().onSnapshot(applySnapshot, () => {});
  } catch {
    // yerel modda devam
  }
}

// ---------- hesap (kendi API'miz + Neon) ----------

let closeRemote: (() => void) | null = null;

/** Misafir verisini (hesapsız kullanım) kullanıcının verisine ekler; aynı gün iki yerde varsa hesaptaki kalır. */
export function mergeGuest(guest: Store): void {
  for (const [d, s] of Object.entries(guest.sessions)) if (!store.sessions[d]) store.sessions[d] = s;
  for (const [d, f] of Object.entries(guest.food)) if (!store.food[d]) store.food[d] = f;
  store.body = { ...guest.body, ...store.body };
  const names = new Set(store.custom.map(c => nameKey(c.name)));
  store.custom = store.custom.concat(guest.custom.filter(c => !names.has(nameKey(c.name))));
  const ids = new Set(store.templates.map(t => t.id));
  store.templates = store.templates.concat(guest.templates.filter(t => !ids.has(t.id)));
  const foods = new Set(store.foodCustom.map(c => nameKey(c.name)));
  store.foodCustom = store.foodCustom.concat(guest.foodCustom.filter(c => !foods.has(nameKey(c.name))));
  store.goals = store.goals || guest.goals;
  store.profile = { ...guest.profile, ...store.profile };
}

/** Giriş yapan kullanıcı için buluta bağlanır; yerel önbellek, misafir verisi ve bulut birleştirilir. */
export async function startAccountSync(user: AccountUser): Promise<void> {
  useStorageFor(user.id);
  loadLocal();
  const guest = takeGuestData();
  if (guest) mergeGuest(guest);
  if (user.name && !store.profile.name) store.profile = { ...store.profile, name: user.name };
  saveLocal();
  render();

  const db = apiDb(flushDirty);
  cloud.db = db;
  cloud.userId = user.id;
  closeRemote = db.close;
  try {
    // Çevrimdışı yapılan düzenlemeler önce gönderilir; yoksa buluttaki eski sürüm üzerine yazardı.
    if (!(await flushDirty())) throw new Error('offline');
    await mergeInitial();
    if (user.name && store.profile.name === user.name) persistSettings();
  } catch {
    // Çevrimdışı: yerel önbellekle devam; değişiklikler kirli olarak tutulur, bağlantı gelince gönderilir.
    cloud.mode = 'cloud';
  }
  render();
  collection().onSnapshot(applySnapshot, e => {
    if (e instanceof ApiError && e.status === 401) window.dispatchEvent(new Event('dd:unauthorized'));
  });
}

/**
 * Bağlantıyı kapatır ve veriyi bellekten siler. Çıkışta cihaz önbelleği de silinir; oturum süresi dolduğunda
 * (keepCache) korunur ki gönderilmemiş düzenlemeler tekrar girişte gönderilebilsin.
 */
export function stopAccountSync({ keepCache }: { keepCache: boolean }): void {
  closeRemote?.();
  closeRemote = null;
  if (!keepCache) {
    clearLocal();
    clearAllDirty();
  }
  cloud.mode = 'local';
  cloud.db = null;
  cloud.userId = null;
  resetStore();
  useStorageFor(null);
}

async function mergeInitial() {
  const snap = await collection().get();
  const remote: Record<DateStr, Session> = {};
  const rFood: Record<DateStr, FoodDay> = {};
  let custom: ExerciseInfo[] = [];
  let rTpl: Template[] = [];
  let rProfile: Profile | null = null;
  let body: Record<DateStr, number> | null = null;
  let nut: RemoteDoc | null = null;
  for (const doc of snap.docs) {
    const v = readDoc(doc);
    if (!v) continue;
    if (doc.id === 'settings') {
      custom = v.custom || [];
      rTpl = v.templates || [];
      rProfile = v.profile || null;
    } else if (doc.id === 'body') body = v.entries || {};
    else if (doc.id === 'nutrition') nut = v;
    else if (v.kind === 'food' && v.date) rFood[v.date] = { items: v.items || [], water: v.water || 0 };
    else if (v.kind === 'session' && v.date) remote[v.date] = sessionFromDoc(v, v.date);
  }
  // persist* çağrıları buluta yazabilsin diye mod burada açılıyor
  cloud.mode = 'cloud';

  // Antrenmanlar: bulutta olmayan yerel günler buluta taşınır.
  const localOnly = Object.keys(store.sessions).filter(
    k => !remote[k] && hasSessionContent(store.sessions[k]),
  );
  localOnly.forEach(k => (remote[k] = store.sessions[k]));

  // Özel hareketler ve şablonlar: isim / id'ye göre birleştir.
  const names = new Set(custom.map(c => nameKey(c.name)));
  const mergedCustom = custom.concat(store.custom.filter(c => !names.has(nameKey(c.name))));
  const tids = new Set(rTpl.map(t => t.id));
  const mergedTpl = rTpl.concat(store.templates.filter(t => !tids.has(t.id)));

  const mergedBody = Object.assign({}, store.body, body || {});
  const bodyChanged = Object.keys(mergedBody).length !== Object.keys(body || {}).length;

  store.sessions = remote;
  store.custom = mergedCustom;
  store.templates = mergedTpl;
  // Profil: bulutta boş alanlar yereldekiyle tamamlanır
  const mergedProfile = { ...store.profile, ...(rProfile || {}) };
  const profileChanged = JSON.stringify(mergedProfile) !== JSON.stringify(rProfile || {});
  store.profile = mergedProfile;
  store.body = mergedBody;
  saveLocal();
  if (bodyChanged) persistBody();

  // Beslenme
  const foodLocalOnly = Object.keys(store.food).filter(
    k => !rFood[k] && (store.food[k].items.length || store.food[k].water),
  );
  foodLocalOnly.forEach(k => (rFood[k] = store.food[k]));
  store.food = rFood;
  const rCustom: CustomFood[] = nut?.custom || [];
  const rn = new Set(rCustom.map(c => nameKey(c.name)));
  const mFoodCustom = rCustom.concat(store.foodCustom.filter(c => !rn.has(nameKey(c.name))));
  const nutNeedsWrite = !nut
    ? store.goals || store.foodCustom.length
    : mFoodCustom.length !== rCustom.length || (!nut.goals && !!store.goals);
  store.goals = nut?.goals || store.goals;
  store.foodCustom = mFoodCustom;
  saveLocal();

  foodLocalOnly.forEach(k => persistFood(k));
  if (nutNeedsWrite) persistNut();
  localOnly.forEach(k => persistSession(k));
  if (mergedCustom.length !== custom.length || mergedTpl.length !== rTpl.length || profileChanged)
    persistSettings();
}

function applySnapshot(snapshot: CloudSnapshot): void {
  let changed = false;
  snapshot.docChanges().forEach(ch => {
    const v = readDoc(ch.doc);
    const id = ch.doc.id;
    const removed = ch.type === 'removed';

    if (id === 'body') {
      if (v && !removed && !pending.body) {
        store.body = v.entries || {};
        changed = true;
      }
      return;
    }
    if (id === 'nutrition') {
      if (v && !removed && !pending.nut) {
        store.goals = v.goals || null;
        store.foodCustom = v.custom || [];
        changed = true;
      }
      return;
    }
    if (id === 'settings') {
      if (v && !removed) {
        store.custom = v.custom || [];
        store.templates = v.templates || [];
        store.profile = v.profile || {};
        changed = true;
      }
      return;
    }
    if (id.startsWith('f-')) {
      const date = id.slice(2);
      if (pending.food[date] || (ui.sheetOpen && date === ui.date)) return;
      if (removed) {
        if (store.food[date]) {
          delete store.food[date];
          changed = true;
        }
      } else if (v && v.kind === 'food') {
        store.food[date] = { items: v.items || [], water: v.water || 0 };
        changed = true;
      }
      return;
    }
    if (id.startsWith('s-')) {
      const date = id.slice(2);
      if (pending.session[date] || (ui.sheetOpen && date === ui.date)) return;
      if (removed) {
        if (store.sessions[date]) {
          delete store.sessions[date];
          changed = true;
        }
      } else if (v && v.kind === 'session') {
        store.sessions[date] = sessionFromDoc(v, date);
        changed = true;
      }
    }
  });
  if (changed) {
    saveLocal();
    if (!ui.sheetOpen) render();
  }
}
