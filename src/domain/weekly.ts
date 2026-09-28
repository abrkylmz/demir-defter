// Haftalık antrenman hedefi ve seri (hedefin art arda tutturulduğu hafta sayısı).
import { addDays, mondayOf, parseYmd, todayStr } from '../lib/date.ts';
import { store } from '../state/store.ts';
import type { DateStr } from '../types.ts';
import { sortedDates } from './workout.ts';

export const DEFAULT_WEEKLY_GOAL = 3;

export const weeklyGoal = (): number => store.profile.weeklyGoal || DEFAULT_WEEKLY_GOAL;

/** Pazartesi → o hafta antrenman yapılan gün sayısı. */
function countByWeek(dates: DateStr[]): Map<DateStr, number> {
  const m = new Map<DateStr, number>();
  for (const d of dates) {
    const w = mondayOf(d);
    m.set(w, (m.get(w) || 0) + 1);
  }
  return m;
}

export interface WeekProgress {
  done: number;
  goal: number;
  /** Hedefin tutturulduğu art arda hafta sayısı (bu hafta tuttuysa o da sayılır) */
  streak: number;
  /** Bu haftanın bitmesine kalan gün (bugün dahil) */
  daysLeft: number;
}

export function weekProgress(today: DateStr = todayStr(), goal = weeklyGoal()): WeekProgress {
  const counts = countByWeek(sortedDates());
  const thisWeek = mondayOf(today);
  const done = counts.get(thisWeek) || 0;
  // Bu hafta henüz bitmedi: tuttuysa seriye ekle, tutmadıysa seriyi bozmaz.
  let streak = done >= goal ? 1 : 0;
  let w = addDays(thisWeek, -7);
  while ((counts.get(w) || 0) >= goal) {
    streak++;
    w = addDays(w, -7);
  }
  const daysLeft = 7 - ((parseYmd(today).getDay() + 6) % 7);
  return { done, goal, streak, daysLeft };
}
