import { beforeEach, describe, expect, it } from 'vitest';
import { foodHasContent, hasAnySupp, monthCount, setSupp, suppStats } from '../src/domain/supplements.ts';
import { addMonths, monthStart } from '../src/lib/date.ts';
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

  it('setSupp sınırlar, sıfırda alanı siler; ay sayımı', () => {
    setSupp('2026-11-01', 'creatine', 1);
    setSupp('2026-11-02', 'creatine', 9);
    setSupp('2026-10-31', 'creatine', 1);
    expect(store.food['2026-11-02'].supp).toEqual({ creatine: 4 });
    expect(monthCount('creatine', '2026-11')).toBe(2);
    setSupp('2026-11-02', 'creatine', 0);
    expect(store.food['2026-11-02'].supp).toBeUndefined();
    expect(monthCount('creatine', '2026-11')).toBe(1);
  });

  it('ay yardımcıları', () => {
    expect(monthStart('2026-11-23')).toBe('2026-11-01');
    expect(addMonths('2026-01-31', 1)).toBe('2026-02-01');
    expect(addMonths('2026-01-15', -1)).toBe('2025-12-01');
  });

  it('yalnızca takviye girilen gün de içerik sayılır', () => {
    expect(foodHasContent(day({ creatine: 1 }))).toBe(true);
    expect(foodHasContent(day({}))).toBe(false);
  });
});
