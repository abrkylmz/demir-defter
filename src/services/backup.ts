// JSON yedek: alma, doğrulama ve geri yükleme.
// Yedek dosyası dışarıdan geldiği için güvenilmez kabul edilir: her alan tip kontrolünden geçer,
// HTML attribute'larına giren id'ler yeniden üretilir, bozuk kayıtlar atlanır.
import { MEALS } from '../data/foods.ts';
import { todayStr } from '../lib/date.ts';
import { uid8 } from '../lib/format.ts';
import { saveLocal, store } from '../state/store.ts';
import type {
  CustomFood,
  Exercise,
  ExerciseInfo,
  FoodItem,
  GoalProfile,
  Goals,
  Macros,
  MealKey,
  Store,
  Template,
} from '../types.ts';
import { persistBody, persistFood, persistNut, persistSession, persistSettings } from './persist.ts';

export const BACKUP_APP = 'demir-defter';
export const BACKUP_VERSION = 1;
const LAST_BACKUP_KEY = 'demirdefter.lastBackup';

// ---------- yedek alma ----------

export function buildBackup(now = new Date()): string {
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

export const backupFilename = (): string => `demir-defter-yedek-${todayStr()}.json`;

export function markBackupDone(): void {
  try {
    localStorage.setItem(LAST_BACKUP_KEY, todayStr());
  } catch {
    // depolama kapalı: hatırlatma gösterilmeye devam eder
  }
}

export function lastBackupDate(): string | null {
  try {
    return localStorage.getItem(LAST_BACKUP_KEY);
  } catch {
    return null;
  }
}

// ---------- doğrulama ----------

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const ID_RE = /^[a-z0-9]{1,16}$/i;
const MEAL_KEYS = new Set<string>(MEALS.map(m => m[0]));

type Obj = Record<string, unknown>;

const isObj = (v: unknown): v is Obj => v !== null && typeof v === 'object' && !Array.isArray(v);
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const str = (v: unknown, max: number): string => (typeof v === 'string' ? v.slice(0, max) : '');
const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const nonNeg = (v: unknown): number => Math.max(0, num(v) ?? 0);
const safeId = (v: unknown): string => (typeof v === 'string' && ID_RE.test(v) ? v : uid8());
const isMeal = (v: unknown): v is MealKey => typeof v === 'string' && MEAL_KEYS.has(v);

function cleanExercise(e: unknown): Exercise | null {
  if (!isObj(e) || !str(e.name, 60).trim()) return null;
  const out: Exercise = {
    id: safeId(e.id),
    name: str(e.name, 60).trim(),
    group: str(e.group, 30) || 'Diğer',
    bar: !!e.bar,
    sets: arr(e.sets)
      .filter((t): t is Obj => isObj(t) && num(t.kg) !== null && num(t.reps) !== null)
      .map(t => ({ kg: nonNeg(t.kg), reps: Math.round(nonNeg(t.reps)) })),
  };
  const note = str(e.note, 500);
  if (note) out.note = note;
  return out;
}

function cleanSessions(raw: unknown): Store['sessions'] {
  const out: Store['sessions'] = {};
  if (!isObj(raw)) return out;
  for (const [date, s] of Object.entries(raw)) {
    if (!DATE_RE.test(date) || !isObj(s)) continue;
    const exercises = arr(s.exercises)
      .map(cleanExercise)
      .filter((e): e is Exercise => e !== null);
    const note = str(s.note, 500);
    if (!exercises.length && !note) continue;
    out[date] = { date, exercises, ...(note ? { note } : {}) };
  }
  return out;
}

const cleanMacros = (p: unknown): Macros => {
  const o = isObj(p) ? p : {};
  return { k: nonNeg(o.k), p: nonNeg(o.p), c: nonNeg(o.c), f: nonNeg(o.f) };
};

function cleanFood(raw: unknown): Store['food'] {
  const out: Store['food'] = {};
  if (!isObj(raw)) return out;
  for (const [date, d] of Object.entries(raw)) {
    if (!DATE_RE.test(date) || !isObj(d)) continue;
    const items: FoodItem[] = arr(d.items)
      .filter((it): it is Obj => isObj(it) && !!str(it.name, 60) && num(it.g) !== null && isObj(it.per))
      .map(it => ({
        id: safeId(it.id),
        name: str(it.name, 60),
        meal: isMeal(it.meal) ? it.meal : 'ara',
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

function cleanBody(raw: unknown): Store['body'] {
  const out: Store['body'] = {};
  if (!isObj(raw)) return out;
  for (const [date, kg] of Object.entries(raw)) {
    const v = num(kg);
    if (DATE_RE.test(date) && v !== null && v > 0) out[date] = v;
  }
  return out;
}

const cleanCustom = (raw: unknown): ExerciseInfo[] =>
  arr(raw)
    .filter((c): c is Obj => isObj(c) && !!str(c.name, 60).trim())
    .map(c => ({ name: str(c.name, 60).trim(), group: str(c.group, 30) || 'Diğer', bar: !!c.bar }));

const cleanTemplates = (raw: unknown): Template[] =>
  arr(raw)
    .filter((t): t is Obj => isObj(t) && !!str(t.name, 40).trim() && Array.isArray(t.exercises))
    .map(t => ({ id: safeId(t.id), name: str(t.name, 40).trim(), exercises: cleanCustom(t.exercises) }));

const cleanFoodCustom = (raw: unknown): CustomFood[] =>
  arr(raw)
    .filter((f): f is Obj => isObj(f) && !!str(f.name, 60).trim())
    .map(f => ({ name: str(f.name, 60).trim(), ...cleanMacros(f), pl: str(f.pl, 20), pg: nonNeg(f.pg) }));

function cleanGoals(g: unknown): Goals | null {
  if (!isObj(g)) return null;
  const kcal = num(g.kcal);
  if (kcal === null || kcal <= 0) return null;
  const out: Goals = { kcal, p: nonNeg(g.p), c: nonNeg(g.c), f: nonNeg(g.f), water: nonNeg(g.water) || 10 };
  if (isObj(g.profile)) out.profile = JSON.parse(JSON.stringify(g.profile)) as GoalProfile;
  return out;
}

export interface BackupSummary {
  workouts: number;
  foodDays: number;
  weighIns: number;
  templates: number;
}

export type ParseResult =
  { ok: true; data: Store; summary: BackupSummary; exportedAt: string | null } | { ok: false; error: string };

const NOT_OURS: ParseResult = { ok: false, error: 'Bu dosya bir Demir Defter yedeği değil.' };

/**
 * Yedek metnini çözer ve temizler.
 * Kabul edilen biçimler: buildBackup() çıktısı ya da doğrudan store nesnesi (eski localStorage kopyası).
 */
export function parseBackup(text: string): ParseResult {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, error: 'Dosya okunamadı. Demir Defter yedeği (.json) seçtiğinden emin ol.' };
  }
  if (!isObj(raw)) return NOT_OURS;
  let src: Obj;
  if (raw.app === BACKUP_APP && isObj(raw.data)) {
    if ((num(raw.version) ?? 0) > BACKUP_VERSION)
      return {
        ok: false,
        error: 'Bu yedek uygulamanın daha yeni bir sürümüyle alınmış. Sayfayı yenileyip tekrar dene.',
      };
    src = raw.data;
  } else if (isObj(raw.sessions)) {
    src = raw;
  } else {
    return NOT_OURS;
  }
  const data: Store = {
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
export function summarize(data: Store = store): BackupSummary {
  return {
    workouts: Object.values(data.sessions).filter(s => s.exercises.some(e => e.sets.length)).length,
    foodDays: Object.values(data.food).filter(d => d.items.length).length,
    weighIns: Object.keys(data.body).length,
    templates: data.templates.length,
  };
}

export const isEmpty = (s: BackupSummary): boolean =>
  !s.workouts && !s.foodDays && !s.weighIns && !s.templates;

// ---------- geri yükleme ----------

/** Bu cihazdaki tüm verileri yedektekilerle değiştirir. Bulut modunda silinen günler buluttan da silinir. */
export function restoreBackup(data: Store): void {
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
