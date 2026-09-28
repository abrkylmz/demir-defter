import { beforeEach, describe, expect, it } from 'vitest';
import { greeting, greetingWord, initial } from '../src/lib/greeting.ts';
import { allRecords, isFresh } from '../src/domain/records.ts';
import { nextTarget, suggestFor, topSet } from '../src/domain/suggest.ts';
import { weekProgress } from '../src/domain/weekly.ts';
import { store } from '../src/state/store.ts';
import type { Exercise, Session } from '../src/types.ts';

const ex = (name: string, sets: [number, number][], bar = true): Exercise => ({
  id: name.slice(0, 8).replace(/\W/g, 'x'),
  name,
  group: 'Göğüs',
  bar,
  sets: sets.map(([kg, reps]) => ({ kg, reps })),
});
const day = (date: string, ...exercises: Exercise[]): [string, Session] => [date, { date, exercises }];

describe('akıllı öneri (çift progresyon)', () => {
  it('12 tekrara ulaşınca ağırlık artar, tekrar 8e döner', () => {
    expect(nextTarget({ kg: 60, reps: 12 }, true)).toMatchObject({ kg: 62.5, reps: 8 });
  });
  it('6–11 tekrar arasında aynı ağırlıkla bir tekrar fazlası', () => {
    expect(nextTarget({ kg: 60, reps: 8 }, true)).toMatchObject({ kg: 60, reps: 9 });
  });
  it('güç aralığında tekrar sabit, ağırlık artar', () => {
    expect(nextTarget({ kg: 100, reps: 5 }, true)).toMatchObject({ kg: 102.5, reps: 5 });
  });
  it('dambılda adım 2 kg, hafif ağırlıkta 1 kg', () => {
    expect(nextTarget({ kg: 20, reps: 12 }, false).kg).toBe(22);
    expect(nextTarget({ kg: 6, reps: 12 }, false).kg).toBe(7);
  });
  it('vücut ağırlığında yalnızca tekrar artar', () => {
    expect(nextTarget({ kg: 0, reps: 10 }, false)).toMatchObject({ kg: 0, reps: 11 });
  });
  it('en iyi set en ağır olandır, eşitse en çok tekrarlı', () => {
    expect(
      topSet([
        { kg: 60, reps: 10 },
        { kg: 65, reps: 5 },
        { kg: 65, reps: 6 },
      ]),
    ).toEqual({ kg: 65, reps: 6 });
  });
  it('geçmişe göre öneri üretir, ilk kez yapılan harekette null', () => {
    store.sessions = Object.fromEntries([
      day(
        '2026-09-20',
        ex('Bench Press', [
          [60, 8],
          [60, 7],
        ]),
      ),
    ]);
    const s = suggestFor('bench press', true, '2026-09-25');
    expect(s).toMatchObject({ kg: 60, reps: 9, basisDate: '2026-09-20' });
    expect(suggestFor('Squat', true, '2026-09-25')).toBeNull();
  });
});

describe('haftalık hedef ve seri', () => {
  beforeEach(() => {
    store.profile = { weeklyGoal: 2 };
    // 2026-09-28 pazartesi. Önceki iki hafta hedef tuttu, ondan önceki tutmadı.
    store.sessions = Object.fromEntries([
      day('2026-09-08', ex('A', [[10, 10]])),
      day('2026-09-14', ex('A', [[10, 10]])),
      day('2026-09-16', ex('A', [[10, 10]])),
      day('2026-09-22', ex('A', [[10, 10]])),
      day('2026-09-26', ex('A', [[10, 10]])),
      day('2026-09-28', ex('A', [[10, 10]])),
    ]);
  });
  it('bu haftayı sayar, tutmayan bu hafta seriyi bozmaz', () => {
    expect(weekProgress('2026-09-28')).toEqual({ done: 1, goal: 2, streak: 2, daysLeft: 7 });
  });
  it('bu hafta da tutunca seri artar', () => {
    store.sessions['2026-09-30'] = { date: '2026-09-30', exercises: [ex('A', [[10, 10]])] };
    expect(weekProgress('2026-10-04')).toMatchObject({ done: 2, streak: 3, daysLeft: 1 });
  });
});

describe('kişisel rekorlar', () => {
  beforeEach(() => {
    store.sessions = Object.fromEntries([
      day('2026-09-01', ex('Bench Press', [[60, 10]]), ex('Dips', [[0, 12]], false)),
      day('2026-09-10', ex('Bench Press', [[70, 3]])),
      day('2026-09-20', ex('Bench Press', [[60, 10]]), ex('Dips', [[0, 15]], false)),
    ]);
  });
  it('rekor tarihi ilk kırıldığı gündür (eşitlemek rekor değildir)', () => {
    const bench = allRecords().find(r => r.name === 'Bench Press')!;
    expect(bench.e1).toEqual({ value: 80, date: '2026-09-01' }); // 60×10 = 80, 70×3 = 77
    expect(bench.heaviest).toEqual({ value: { kg: 70, reps: 3 }, date: '2026-09-10' });
    expect(bench.sessions).toBe(3);
  });
  it('vücut ağırlığı hareketinde 1TM yok, en çok tekrar var', () => {
    const dips = allRecords().find(r => r.name === 'Dips')!;
    expect(dips.e1).toBeUndefined();
    expect(dips.mostReps).toEqual({ value: { kg: 0, reps: 15 }, date: '2026-09-20' });
  });
  it('en son rekor kırılan hareket önce gelir', () => {
    expect(allRecords().map(r => r.name)).toEqual(['Dips', 'Bench Press']);
  });
  it('son 7 gün yeni sayılır', () => {
    expect(isFresh('2026-09-25', '2026-09-28')).toBe(true);
    expect(isFresh('2026-09-20', '2026-09-28')).toBe(false);
  });
});

describe('selamlama', () => {
  it('saat sınırları', () => {
    expect([4, 5, 11, 12, 17, 18, 23].map(h => greetingWord(h))).toEqual([
      'İyi geceler',
      'Günaydın',
      'Günaydın',
      'İyi günler',
      'İyi günler',
      'İyi akşamlar',
      'İyi akşamlar',
    ]);
  });
  it('adla birlikte', () => {
    expect(greeting(9, 'Ahmet')).toBe('Günaydın, Ahmet');
    expect(greeting(20, '  ')).toBe('İyi akşamlar');
    expect(greeting(14)).toBe('İyi günler');
  });
  it('Türkçe baş harf', () => {
    expect(initial('ilker')).toBe('İ');
    expect(initial('')).toBe('');
  });
});
