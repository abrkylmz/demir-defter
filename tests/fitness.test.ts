import { describe, expect, it } from 'vitest';
import { calcTargets, e1rm, platesFor, type TargetInput } from '../src/lib/fitness.ts';

describe('e1rm (Epley)', () => {
  it('tek tekrarda ağırlığın kendisini döner', () => {
    expect(e1rm(100, 1)).toBe(100);
  });
  it('10 tekrar için kg × (1 + 10/30)', () => {
    expect(e1rm(60, 10)).toBeCloseTo(80);
  });
  it('12 tekrarın üstünde, sıfır ağırlıkta ya da tekrarda 0 döner', () => {
    expect(e1rm(60, 13)).toBe(0);
    expect(e1rm(0, 5)).toBe(0);
    expect(e1rm(60, 0)).toBe(0);
  });
});

describe('platesFor', () => {
  it('bardan hafif ağırlıkta null döner', () => {
    expect(platesFor(15)).toBeNull();
  });
  it('sadece bar', () => {
    expect(platesFor(20)).toEqual({ plates: [], rest: 0 });
  });
  it('bir tarafa büyükten küçüğe plaka dizer', () => {
    expect(platesFor(100)?.plates).toEqual([25, 15]);
    expect(platesFor(142.5)?.plates).toEqual([25, 25, 10, 1.25]);
  });
  it('karşılanamayan kısmı rest olarak döner', () => {
    expect(platesFor(21)).toEqual({ plates: [], rest: 1 });
  });
});

describe('calcTargets (Mifflin-St Jeor)', () => {
  const base: Omit<TargetInput, 'goal'> = { sex: 'e', age: 30, height: 180, weight: 80, act: '1.55' };

  it('korumada kalori TDEE’ye eşit (10’a yuvarlanmış)', () => {
    const r = calcTargets({ ...base, goal: 'keep' });
    // BMR = 800 + 1125 - 150 + 5 = 1780, TDEE = 2759
    expect(r.tdee).toBeCloseTo(2759);
    expect(r.kcal).toBe(2760);
    expect(r.p).toBe(144);
  });
  it('yağ yakmada %15 açık ve kg başına 2 g protein', () => {
    const r = calcTargets({ ...base, goal: 'cut' });
    expect(r.kcal).toBe(Math.round((2759 * 0.85) / 10) * 10);
    expect(r.p).toBe(160);
  });
  it('makrolar kaloriyi aşmaz', () => {
    const r = calcTargets({ ...base, goal: 'bulk' });
    expect(r.p * 4 + r.c * 4 + r.f * 9).toBeLessThanOrEqual(r.kcal + 5);
  });
  it('su en az 8 bardak', () => {
    expect(calcTargets({ ...base, weight: 40, goal: 'keep' }).water).toBe(8);
  });
});
