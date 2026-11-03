import { beforeEach, describe, expect, it } from 'vitest';
import { foodHasContent, hasAnySupp, suppStats } from '../src/domain/supplements.ts';
import { store } from '../src/state/store.ts';
import type { SuppDay } from '../src/types.ts';

const TODAY = '2026-11-03';
const day = (supp: SuppDay) => ({ items: [], water: 0, supp });

beforeEach(() => {
  store.food = {};
});

describe('takviyeler', () => {
  it('kayıt yoksa sıfır', () => {
    expect(hasAnySupp()).toBe(false);
    expect(suppStats('creatine', TODAY)).toEqual({ week: 0, month: 0, streak: 0, last: null });
  });

  it('7 / 30 günlük sıklık ve seri', () => {
    store.food = {
      '2026-11-03': day({ creatine: 1 }),
      '2026-11-02': day({ creatine: 1, protein: 2 }),
      '2026-11-01': day({ creatine: 1 }),
      '2026-10-30': day({ creatine: 1 }),
      '2026-10-10': day({ creatine: 1 }),
      '2026-09-01': day({ creatine: 1 }),
      '2026-11-04': day({ creatine: 1 }), // gelecek sayılmaz
    };
    expect(hasAnySupp()).toBe(true);
    expect(suppStats('creatine', TODAY)).toEqual({ week: 4, month: 5, streak: 3, last: '2026-11-03' });
    expect(suppStats('protein', TODAY)).toEqual({ week: 1, month: 1, streak: 1, last: '2026-11-02' });
  });

  it('bugün henüz alınmadıysa seri dünden sayılır', () => {
    store.food = { '2026-11-02': day({ protein: 1 }), '2026-11-01': day({ protein: 1 }) };
    expect(suppStats('protein', TODAY).streak).toBe(2);
  });

  it('yalnızca takviye girilen gün de içerik sayılır', () => {
    expect(foodHasContent(day({ creatine: 1 }))).toBe(true);
    expect(foodHasContent(day({}))).toBe(false);
  });
});
