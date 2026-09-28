// JSON yedek: alma, doğrulama ve geri yükleme.
// Yedek dosyası dışarıdan geldiği için güvenilmez kabul edilir: her alan tip kontrolünden geçer,
// HTML attribute'larına giren id'ler yeniden üretilir, bozuk kayıtlar atlanır.
import { MEALS } from '../data/foods.js';
import { todayStr } from '../lib/date.js';
import { uid8 } from '../lib/format.js';
import { saveLocal, store } from '../state/store.js';
import { persistBody, persistFood, persistNut, persistSession, persistSettings } from './persist.js';

export const BACKUP_APP = 'demir-defter';
export const BACKUP_VERSION = 1;
const LAST_BACKUP_KEY = 'demirdefter.lastBackup';

// ---------- yedek alma ----------

export function buildBackup(now = new Date()) {
  const { sessions, custom, templates, body, food, foodCustom, goals } = store;
  return JSON.stringify(
    {
      app: BACKUP_APP,
      version: BACKUP_VERSION,
      exportedAt: now.toISOString(),
      data: { sessions, custom, templates, body, food, foodCustom, goals },
    },
    null,
    1,
  );
}

export const backupFilename = () => `demir-defter-yedek-${todayStr()}.json`;

export function markBackupDone() {
  try {
    localStorage.setItem(LAST_BACKUP_KEY, todayStr());
  } catch {
    // depolama kapalı: hatırlatma gösterilmeye devam eder
  }
}

export function lastBackupDate() {
  try {
    return localStorage.getItem(LAST_BACKUP_KEY);
  } catch {
    return null;
  }
}

// ---------- doğrulama ----------

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const ID_RE = /^[a-z0-9]{1,16}$/i;
const MEAL_KEYS = new Set(MEALS.map(m => m[0]));

const isObj = v => v !== null && typeof v === 'object' && !Array.isArray(v);
const str = (v, max) => (typeof v === 'string' ? v.slice(0, max) : '');
const num = v => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const nonNeg = v => Math.max(0, num(v) ?? 0);
const safeId = v => (typeof v === 'string' && ID_RE.test(v) ? v : uid8());

function cleanExercise(e) {
  if (!isObj(e) || !str(e.name, 60).trim()) return null;
  const out = {
    id: safeId(e.id),
    name: str(e.name, 60).trim(),
    group: str(e.group, 30) || 'Diğer',
    bar: !!e.bar,
    sets: (Array.isArray(e.sets) ? e.sets : [])
      .filter(t => isObj(t) && num(t.kg) !== null && num(t.reps) !== null)
      .map(t => ({ kg: nonNeg(t.kg), reps: Math.round(nonNeg(t.reps)) })),
  };
  if (str(e.note, 500)) out.note = str(e.note, 500);
  return out;
}

function cleanSessions(raw) {
  const out = {};
  if (!isObj(raw)) return out;
  for (const [date, s] of Object.entries(raw)) {
    if (!DATE_RE.test(date) || !isObj(s)) continue;
    const exercises = (Array.isArray(s.exercises) ? s.exercises : []).map(cleanExercise).filter(Boolean);
    const note = str(s.note, 500);
    if (!exercises.length && !note) continue;
    out[date] = { date, exercises, ...(note ? { note } : {}) };
  }
  return out;
}

const cleanMacros = p => ({ k: nonNeg(p?.k), p: nonNeg(p?.p), c: nonNeg(p?.c), f: nonNeg(p?.f) });

function cleanFood(raw) {
  const out = {};
  if (!isObj(raw)) return out;
  for (const [date, d] of Object.entries(raw)) {
    if (!DATE_RE.test(date) || !isObj(d)) continue;
    const items = (Array.isArray(d.items) ? d.items : [])
      .filter(it => isObj(it) && str(it.name, 60) && num(it.g) !== null && isObj(it.per))
      .map(it => ({
        id: safeId(it.id),
        name: str(it.name, 60),
        meal: MEAL_KEYS.has(it.meal) ? it.meal : 'ara',
        g: nonNeg(it.g),
        per: cleanMacros(it.per),
        pl: str(it.pl, 20),
        pg: nonNeg(it.pg),
      }));
    const water = Math.round(nonNeg(d.water));
    if (items.length || water) out[date] = { items, water };
  }
  return out;
}

function cleanBody(raw) {
  const out = {};
  if (!isObj(raw)) return out;
  for (const [date, kg] of Object.entries(raw)) if (DATE_RE.test(date) && num(kg) > 0) out[date] = kg;
  return out;
}

const cleanCustom = raw =>
  (Array.isArray(raw) ? raw : [])
    .filter(c => isObj(c) && str(c.name, 60).trim())
    .map(c => ({ name: str(c.name, 60).trim(), group: str(c.group, 30) || 'Diğer', bar: !!c.bar }));

const cleanTemplates = raw =>
  (Array.isArray(raw) ? raw : [])
    .filter(t => isObj(t) && str(t.name, 40).trim() && Array.isArray(t.exercises))
    .map(t => ({
      id: safeId(t.id),
      name: str(t.name, 40).trim(),
      exercises: cleanCustom(t.exercises),
    }));

const cleanFoodCustom = raw =>
  (Array.isArray(raw) ? raw : [])
    .filter(f => isObj(f) && str(f.name, 60).trim())
    .map(f => ({ name: str(f.name, 60).trim(), ...cleanMacros(f), pl: str(f.pl, 20), pg: nonNeg(f.pg) }));

function cleanGoals(g) {
  if (!isObj(g) || !(num(g.kcal) > 0)) return null;
  const out = { kcal: g.kcal, p: nonNeg(g.p), c: nonNeg(g.c), f: nonNeg(g.f), water: nonNeg(g.water) || 10 };
  if (isObj(g.profile)) out.profile = JSON.parse(JSON.stringify(g.profile));
  return out;
}

/**
 * Yedek metnini çözer ve temizler.
 * Kabul edilen biçimler: buildBackup() çıktısı ya da doğrudan store nesnesi (eski localStorage kopyası).
 * @returns {{ok: true, data: object, summary: object, exportedAt: string|null} | {ok: false, error: string}}
 */
export function parseBackup(text) {
  let raw;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, error: 'Dosya okunamadı. Demir Defter yedeği (.json) seçtiğinden emin ol.' };
  }
  if (!isObj(raw)) return { ok: false, error: 'Bu dosya bir Demir Defter yedeği değil.' };
  let src;
  if (raw.app === BACKUP_APP && isObj(raw.data)) {
    if (num(raw.version) > BACKUP_VERSION)
      return {
        ok: false,
        error: 'Bu yedek uygulamanın daha yeni bir sürümüyle alınmış. Sayfayı yenileyip tekrar dene.',
      };
    src = raw.data;
  } else if (isObj(raw.sessions)) {
    src = raw;
  } else {
    return { ok: false, error: 'Bu dosya bir Demir Defter yedeği değil.' };
  }
  const data = {
    sessions: cleanSessions(src.sessions),
    custom: cleanCustom(src.custom),
    templates: cleanTemplates(src.templates),
    body: cleanBody(src.body),
    food: cleanFood(src.food),
    foodCustom: cleanFoodCustom(src.foodCustom),
    goals: cleanGoals(src.goals),
  };
  return {
    ok: true,
    data,
    summary: summarize(data),
    exportedAt: typeof raw.exportedAt === 'string' ? raw.exportedAt : null,
  };
}

/** Ekranda göstermek için kayıt sayıları. */
export function summarize(data = store) {
  const workouts = Object.values(data.sessions).filter(s => s.exercises.some(e => e.sets.length)).length;
  return {
    workouts,
    foodDays: Object.values(data.food).filter(d => d.items.length).length,
    weighIns: Object.keys(data.body).length,
    templates: data.templates.length,
  };
}

export const isEmpty = s => !s.workouts && !s.foodDays && !s.weighIns && !s.templates;

// ---------- geri yükleme ----------

/** Bu cihazdaki tüm verileri yedektekilerle değiştirir. Bulut modunda silinen günler buluttan da silinir. */
export function restoreBackup(data) {
  const oldSessions = Object.keys(store.sessions);
  const oldFood = Object.keys(store.food);
  Object.assign(store, data);
  saveLocal();
  new Set([...oldSessions, ...Object.keys(store.sessions)]).forEach(persistSession);
  new Set([...oldFood, ...Object.keys(store.food)]).forEach(persistFood);
  persistBody();
  persistSettings();
  persistNut();
}
