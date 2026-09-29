import { beforeEach, describe, expect, it } from 'vitest';
import {
  buildReport,
  nextAnchor,
  pctChange,
  periodRange,
  previousAnchor,
  recordEvents,
} from '../src/domain/report.ts';
import { resetStore, store } from '../src/state/store.ts';
import type { Exercise, FoodItem } from '../src/types.ts';

const ex = (name: string, group: string, sets: [number, number][]): Exercise => ({
  id: name.slice(0, 6).replace(/\W/g, 'x'),
  name,
  group,
  bar: true,
  sets: sets.map(([kg, reps]) => ({ kg, reps })),
});
const food = (k: number, p: number): FoodItem => ({
  id: 'f' + k,
  name: 'X',
  meal: 'ogle',
  g: 100,
  per: { k, p, c: 0, f: 0 },
  pl: '',
  pg: 0,
});

describe('dönem aralıkları', () => {
  it('hafta pazartesi başlar, ay takvim ayıdır', () => {
    expect(periodRange('week', '2026-10-01')).toMatchObject({ from: '2026-09-28', to: '2026-10-04' });
    const m = periodRange('month', '2026-02-10');
    expect([m.from, m.to, m.days.length]).toEqual(['2026-02-01', '2026-02-28', 28]);
  });
  it('önceki ve sonraki dönem', () => {
    expect(previousAnchor('week', '2026-10-01')).toBe('2026-09-27');
    expect(nextAnchor('month', '2026-09-15')).toBe('2026-10-01');
  });
  it('yüzde değişim', () => {
    expect(pctChange(120, 100)).toBe(20);
    expect(pctChange(5, 0)).toBeNull();
    expect(pctChange(null, 3)).toBeNull();
  });
});

describe('rapor', () => {
  beforeEach(() => {
    resetStore();
    store.profile = { weeklyGoal: 3 };
    store.goals = { kcal: 2000, p: 150, c: 200, f: 60, water: 10 };
    // Önceki hafta (21–27 Eyl): 1 antrenman
    store.sessions['2026-09-22'] = { date: '2026-09-22', exercises: [ex('Bench Press', 'Göğüs', [[60, 8]])] };
    // Bu hafta (28 Eyl – 4 Eki): 3 antrenman, Bench rekoru
    store.sessions['2026-09-28'] = {
      date: '2026-09-28',
      exercises: [
        ex('Bench Press', 'Göğüs', [
          [62.5, 8],
          [62.5, 8],
        ]),
      ],
    };
    store.sessions['2026-09-30'] = { date: '2026-09-30', exercises: [ex('Squat', 'Bacak', [[100, 5]])] };
    store.sessions['2026-10-02'] = {
      date: '2026-10-02',
      exercises: [ex('Squat', 'Bacak', [[100, 5]]), ex('Barfiks', 'Sırt', [[0, 10]])],
    };
    store.food['2026-09-28'] = { items: [food(2000, 160)], water: 0 };
    store.food['2026-09-29'] = { items: [food(1500, 100)], water: 0 };
    store.food['2026-09-24'] = { items: [food(2500, 90)], water: 0 };
    store.body = { '2026-09-25': 80, '2026-09-29': 79.6, '2026-10-03': 79.2 };
  });

  it('antrenman özeti ve önceki hafta', () => {
    const r = buildReport('week', '2026-10-01', '2026-10-01');
    expect(r.workout).toEqual({ sessions: 3, goal: 3, sets: 5, volume: 62.5 * 16 + 500 * 2 });
    expect(r.prevWorkout.sessions).toBe(1);
    expect(r.current).toBe(true);
    expect(r.groups).toEqual([
      { group: 'Bacak', sets: 2 },
      { group: 'Göğüs', sets: 2 },
      { group: 'Sırt', sets: 1 },
    ]);
    expect(r.missingGroups).toEqual(['Omuz', 'Kol', 'Karın']);
  });

  it('rekor: ilk kayıt sayılmaz, iyileşme sayılır', () => {
    const ev = recordEvents('2026-09-28', '2026-10-04');
    expect(ev.map(e => e.name)).toEqual(['Bench Press']); // Squat ilk kez bu hafta: rekor değil
    expect(ev[0].prev).toBeCloseTo(76);
    expect(ev[0].value).toBeCloseTo(79.17, 1);
  });

  it('beslenme: ortalama yalnızca kayıtlı günler, hedef ve protein günleri', () => {
    const n = buildReport('week', '2026-10-01', '2026-10-01').nutrition;
    expect(n.days).toHaveLength(7);
    expect(n.logged).toBe(2);
    expect(n.avgK).toBe(1750);
    expect(n.kcalHit).toBe(1); // 2000 hedefte, 1500 değil
    expect(n.proteinHit).toBe(1); // 160 ≥ 135, 100 değil
  });

  it('kilo: dönemden önceki son tartıdan dönemin son tartısına', () => {
    const b = buildReport('week', '2026-10-01').body;
    expect(b).toMatchObject({ start: 80, end: 79.2, entries: 2 });
    expect(b.change).toBeCloseTo(-0.8);
  });

  it('öne çıkanlar kelimelerle yargı verir', () => {
    const ins = buildReport('week', '2026-10-01', '2026-10-01').insights;
    expect(ins[0]).toBe('Antrenman hedefin tamam: 3/3.');
    expect(ins).toContain('Bench Press rekoru: tahmini 1TM 76 → 79 kg.');
    expect(ins).toContain('Protein hedefini 2 günün 1 gününde tutturdun.');
    expect(ins.some(s => s.startsWith('Kilon 0,8 kg düştü; ortalama kalorin hedefinin %13 altında'))).toBe(
      true,
    );
  });

  it('ay: hedef haftalık hedefin aya oranı', () => {
    expect(buildReport('month', '2026-09-10').workout.goal).toBe(13); // 3 × 30 / 7
  });
});
