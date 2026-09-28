// Antrenman ve beslenme hesapları. DOM'a ve depolamaya bağımlı değil; birim testleri tests/ altında.

/** Epley formülüyle tahmini 1 tekrar maksimum. 12 tekrarın üstünde güvenilir olmadığı için 0 döner. */
export const e1rm = (kg, reps) => {
  if (!(kg > 0 && reps > 0 && reps <= 12)) return 0;
  return reps === 1 ? kg : kg * (1 + reps / 30);
};

export const BAR_KG = 20;
export const PLATE_KG = [25, 20, 15, 10, 5, 2.5, 1.25];

/**
 * Olimpik bar için bir tarafa takılacak plakalar (büyükten küçüğe).
 * Bar ağırlığının altındaki değerler için null döner.
 * `rest`: mevcut plakalarla karşılanamayan toplam kg.
 */
export function platesFor(kg) {
  let side = (kg - BAR_KG) / 2;
  if (side < 0) return null;
  const plates = [];
  for (const p of PLATE_KG) {
    while (side >= p - 1e-9) {
      plates.push(p);
      side -= p;
    }
  }
  return { plates, rest: Math.round(side * 2 * 100) / 100 };
}

export const ACTIVITY = { light: '1.375', moderate: '1.55', high: '1.725' };
const GOAL_FACTOR = { cut: 0.85, keep: 1, bulk: 1.1 };

/**
 * Mifflin-St Jeor ile günlük hedefler.
 * @param {{sex:'e'|'k', age:number, height:number, weight:number, act:string, goal:'cut'|'keep'|'bulk'}} p
 */
export function calcTargets({ sex, age, height, weight, act, goal }) {
  const bmr = 10 * weight + 6.25 * height - 5 * age + (sex === 'e' ? 5 : -161);
  const tdee = bmr * parseFloat(act);
  const kcal = Math.round((tdee * GOAL_FACTOR[goal]) / 10) * 10;
  const p = Math.round(weight * (goal === 'cut' ? 2.0 : 1.8));
  const f = Math.round((kcal * 0.25) / 9);
  const c = Math.max(0, Math.round((kcal - p * 4 - f * 9) / 4));
  const water = Math.max(8, Math.round((weight * 0.035) / 0.25));
  return { tdee, kcal, p, c, f, water };
}
