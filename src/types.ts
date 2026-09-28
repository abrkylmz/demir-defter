// Uygulamanın veri modeli. localStorage'daki ve yedek dosyalarındaki biçim bununla aynıdır;
// alan eklerken eski verilerle uyumu koru (yeni alanlar isteğe bağlı olmalı).

/** Yerel saatle "YYYY-MM-DD". */
export type DateStr = string;

export interface SetEntry {
  kg: number;
  reps: number;
}

export interface ExerciseInfo {
  name: string;
  group: string;
  bar: boolean;
}

export interface Exercise extends ExerciseInfo {
  id: string;
  sets: SetEntry[];
  note?: string;
}

export interface Session {
  date: DateStr;
  exercises: Exercise[];
  note?: string;
}

export interface Template {
  id: string;
  name: string;
  exercises: ExerciseInfo[];
}

/** 100 g başına kcal, protein, karbonhidrat, yağ. */
export interface Macros {
  k: number;
  p: number;
  c: number;
  f: number;
}

export type MealKey = 'kahvalti' | 'ogle' | 'aksam' | 'ara';

export interface FoodItem {
  id: string;
  name: string;
  meal: MealKey;
  /** gram */
  g: number;
  per: Macros;
  /** porsiyon adı ve gramı ("adet", 50) */
  pl: string;
  pg: number;
}

export interface FoodDay {
  items: FoodItem[];
  /** bardak (250 ml) */
  water: number;
}

export interface CustomFood extends Macros {
  name: string;
  pl: string;
  pg: number;
}

/** Besin seçicide listelenen besin (tablo ya da kullanıcının kendi besini). */
export interface Food extends CustomFood {
  cat: string;
  mine?: boolean;
}

export type Sex = 'e' | 'k';
export type GoalKind = 'cut' | 'keep' | 'bulk';

export interface GoalProfile {
  sex: Sex;
  age: number | '';
  height: number | '';
  weight: number | '';
  act: string;
  goal: GoalKind;
}

export interface Goals {
  kcal: number;
  p: number;
  c: number;
  f: number;
  water: number;
  profile?: GoalProfile;
}

export interface Store {
  sessions: Record<DateStr, Session>;
  custom: ExerciseInfo[];
  templates: Template[];
  body: Record<DateStr, number>;
  food: Record<DateStr, FoodDay>;
  foodCustom: CustomFood[];
  goals: Goals | null;
}

export type Tab = 'home' | 'log' | 'food' | 'history' | 'progress' | 'body';
