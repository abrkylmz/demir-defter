// Akıllı öneri: bir önceki antrenmana göre bugün denenecek ağırlık ve tekrar (progressive overload).
// "Çift progresyon": önce tekrar artırılır, üst sınıra ulaşınca ağırlık artar ve tekrar alt sınıra döner.
import type { DateStr, SetEntry } from '../types.ts';
import { lastTime } from './workout.ts';

/** Hipertrofi aralığının üst ve alt sınırı. */
export const REP_CEILING = 12;
export const REP_FLOOR = 8;
/** Bu tekrar ve altı güç çalışması sayılır: tekrar sabit, ağırlık artar. */
export const STRENGTH_MAX_REPS = 5;

export interface Suggestion extends SetEntry {
  /** Kullanıcıya gösterilen kısa gerekçe */
  reason: string;
  /** Önerinin dayandığı önceki set */
  basis: SetEntry;
  basisDate: DateStr;
}

/** Ağırlık artış adımı: barbell 2,5 kg; dambıl/makine 2 kg, hafif ağırlıklarda 1 kg. */
export const weightStep = (bar: boolean, kg: number): number => (bar ? 2.5 : kg < 10 ? 1 : 2);

/** Bir günün "en iyi" seti: en ağır, eşitse en çok tekrarlı. */
export function topSet(sets: SetEntry[]): SetEntry {
  return sets.reduce((best, t) => (t.kg > best.kg || (t.kg === best.kg && t.reps > best.reps) ? t : best));
}

/** Önceki set için sıradaki hedef. Saf fonksiyon; tarih ve geçmişten bağımsız test edilebilir. */
export function nextTarget(prev: SetEntry, bar: boolean): Omit<Suggestion, 'basis' | 'basisDate'> {
  const { kg, reps } = prev;
  if (kg <= 0) return { kg: 0, reps: reps + 1, reason: 'Vücut ağırlığıyla bir tekrar fazlasını dene' };
  const step = weightStep(bar, kg);
  if (reps >= REP_CEILING)
    return { kg: kg + step, reps: REP_FLOOR, reason: `${reps} tekrara ulaştın, ağırlığı artırma zamanı` };
  if (reps <= STRENGTH_MAX_REPS)
    return { kg: kg + step, reps, reason: `Güç aralığındasın, aynı tekrarla ${step} kg ekle` };
  return { kg, reps: reps + 1, reason: 'Aynı ağırlıkla bir tekrar fazlasını dene' };
}

/** Hareket için bugünkü öneri; hareket daha önce yapılmadıysa null. */
export function suggestFor(name: string, bar: boolean, date: DateStr): Suggestion | null {
  const lt = lastTime(name, date);
  if (!lt) return null;
  const basis = topSet(lt.sets);
  return { ...nextTarget(basis, bar), basis, basisDate: lt.date };
}
