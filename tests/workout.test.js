import { beforeEach, describe, expect, it } from 'vitest';
import { bestE1, exerciseHistory, groupSets, lastTime, sortedDates } from '../src/domain/workout.js';
import { buildCsv } from '../src/services/export.js';
import { store } from '../src/state/store.js';

const ex = (name, group, sets, extra = {}) => ({
  id: name,
  name,
  group,
  bar: false,
  sets: sets.map(([kg, reps]) => ({ kg, reps })),
  ...extra,
});

beforeEach(() => {
  store.sessions = {
    '2026-09-20': {
      date: '2026-09-20',
      exercises: [
        ex(
          'Bench Press',
          'Göğüs',
          [
            [60, 8],
            [60, 8],
          ],
          { note: 'Bank 3. delik' },
        ),
      ],
    },
    '2026-09-26': {
      date: '2026-09-26',
      note: 'Uykusuzdum',
      exercises: [
        ex('Bench Press', 'Göğüs', [
          [62.5, 8],
          [65, 5],
        ]),
        ex('Squat', 'Bacak', [[80, 5]]),
      ],
    },
    // setsiz gün: geçmişte sayılmaz
    '2026-09-27': { date: '2026-09-27', exercises: [ex('Squat', 'Bacak', [])] },
  };
  store.body = {};
  store.food = {};
});

describe('antrenman sorguları', () => {
  it('sortedDates yalnızca seti olan günleri sıralı döner', () => {
    expect(sortedDates()).toEqual(['2026-09-20', '2026-09-26']);
  });

  it('lastTime önceki kaydı ve notunu bulur', () => {
    const lt = lastTime('bench press', '2026-09-26');
    expect(lt.date).toBe('2026-09-20');
    expect(lt.note).toBe('Bank 3. delik');
    expect(lastTime('Bench Press', '2026-09-20')).toBeNull();
  });

  it('exerciseHistory en ağır seti seçer', () => {
    const h = exerciseHistory('Bench Press');
    expect(h).toHaveLength(2);
    expect(h[1].top).toEqual({ kg: 65, reps: 5 });
    expect(h[1].sets).toBe(2);
  });

  it('bestE1 hariç tutulan seti saymaz', () => {
    const top = store.sessions['2026-09-26'].exercises[0].sets[0]; // 62,5 × 8 → 79,17
    expect(bestE1('Bench Press')).toBeCloseTo(79.17, 1);
    expect(bestE1('Bench Press', top)).toBeCloseTo(76, 1); // 60 × 8, 65 × 5'ten (75,83) yüksek
  });

  it('groupSets tarih aralığında kas grubu başına set sayar', () => {
    expect(groupSets('2026-09-21', '2026-09-27')).toEqual({ Göğüs: 2, Bacak: 1 });
    expect(groupSets('2026-09-14', '2026-09-20')).toEqual({ Göğüs: 2 });
  });
});

describe('CSV', () => {
  it('başlık, gün notu ve hareket notu içerir', () => {
    const lines = buildCsv().slice(1).split('\n');
    expect(lines[0]).toBe('Tarih,Hareket,Kas grubu,Set,Kg,Tekrar,Not');
    expect(lines).toContain('2026-09-20,Bench Press,Göğüs,1,60,8,Bank 3. delik');
    expect(lines).toContain('2026-09-26,Günün notu,,,,,Uykusuzdum');
  });
});
