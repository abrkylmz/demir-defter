// claude.ai bulut senkronu: ilk yüklemede yerel ve bulut verilerini birleştirir, sonra canlı güncellemeleri dinler.
// window.claude yoksa (yerel geliştirme, Vercel) hiçbir şey yapmaz ve uygulama localStorage ile çalışır.
import { $ } from '../lib/dom.ts';
import { clone, nameKey, uid8 } from '../lib/format.ts';
import { saveLocal, store } from '../state/store.ts';
import { ui } from '../state/ui.ts';
import { render } from '../views/render.ts';
import { cloud, collection } from './db.ts';
import { pending, persistBody, persistFood, persistNut, persistSession, persistSettings } from './persist.ts';
import type {
  CustomFood,
  DateStr,
  Exercise,
  ExerciseInfo,
  FoodDay,
  FoodItem,
  Goals,
  Session,
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

async function mergeInitial() {
  const snap = await collection().get();
  const remote: Record<DateStr, Session> = {};
  const rFood: Record<DateStr, FoodDay> = {};
  let custom: ExerciseInfo[] = [];
  let rTpl: Template[] = [];
  let body: Record<DateStr, number> | null = null;
  let nut: RemoteDoc | null = null;
  for (const doc of snap.docs) {
    const v = readDoc(doc);
    if (!v) continue;
    if (doc.id === 'settings') {
      custom = v.custom || [];
      rTpl = v.templates || [];
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
  if (mergedCustom.length !== custom.length || mergedTpl.length !== rTpl.length) persistSettings();
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
