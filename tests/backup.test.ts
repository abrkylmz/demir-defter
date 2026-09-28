import { beforeEach, describe, expect, it } from 'vitest';
import { buildBackup, parseBackup, restoreBackup, summarize } from '../src/services/backup.ts';
import { store } from '../src/state/store.ts';

/** Başarılı sonucu döner; değilse testi düşürür. */
function ok(text: string) {
  const r = parseBackup(text);
  if (!r.ok) throw new Error(r.error);
  return r;
}

beforeEach(() => {
  Object.assign(store, {
    sessions: {
      '2026-09-26': {
        date: '2026-09-26',
        note: 'İyi geçti',
        exercises: [
          { id: 'abc12345', name: 'Squat', group: 'Bacak', bar: true, sets: [{ kg: 100, reps: 5 }] },
        ],
      },
    },
    custom: [{ name: 'Kablo Pullover', group: 'Sırt', bar: false }],
    templates: [{ id: 't1', name: 'Bacak', exercises: [{ name: 'Squat', group: 'Bacak', bar: true }] }],
    body: { '2026-09-26': 80.4 },
    food: {
      '2026-09-26': {
        items: [
          {
            id: 'f1',
            name: 'Yumurta',
            meal: 'kahvalti',
            g: 100,
            per: { k: 143, p: 12.6, c: 0.7, f: 9.5 },
            pl: 'adet',
            pg: 50,
          },
        ],
        water: 4,
      },
    },
    foodCustom: [],
    goals: { kcal: 2600, p: 150, c: 300, f: 72, water: 10 },
  });
});

describe('yedek', () => {
  it('alınan yedek aynen geri okunur', () => {
    const before = JSON.parse(JSON.stringify(store));
    const r = ok(buildBackup());
    expect(r.data).toEqual(before);
    expect(r.summary).toEqual({ workouts: 1, foodDays: 1, weighIns: 1, templates: 1 });
  });

  it('eski localStorage kopyasını (doğrudan store) da kabul eder', () => {
    const r = ok(JSON.stringify(store));
    expect(r.summary.workouts).toBe(1);
  });

  it('JSON olmayan ya da başka uygulamaya ait dosyayı reddeder', () => {
    expect(parseBackup('merhaba').ok).toBe(false);
    expect(parseBackup('[]').ok).toBe(false);
    expect(parseBackup('{"foo":1}').ok).toBe(false);
  });

  it('daha yeni sürümün yedeğini reddeder', () => {
    const r = parseBackup(JSON.stringify({ app: 'demir-defter', version: 99, data: {} }));
    expect(r.ok).toBe(false);
  });

  it('bozuk kayıtları atlar, tehlikeli id’leri yeniden üretir', () => {
    const r = ok(
      JSON.stringify({
        app: 'demir-defter',
        version: 1,
        data: {
          sessions: {
            'geçersiz-tarih': { exercises: [] },
            '2026-09-27': {
              exercises: [
                {
                  id: '"><img src=x onerror=alert(1)>',
                  name: 'Bench',
                  sets: [{ kg: 60, reps: 8 }, { kg: 'x' }],
                },
                { name: '' },
              ],
            },
          },
          body: { '2026-09-27': -5, '2026-09-28': 79 },
          food: { '2026-09-27': { items: [{ name: 'X', g: 10, per: {}, meal: 'gece yarısı' }] } },
        },
      }),
    );
    expect(Object.keys(r.data.sessions)).toEqual(['2026-09-27']);
    const ex = r.data.sessions['2026-09-27'].exercises;
    expect(ex).toHaveLength(1);
    expect(ex[0].id).toMatch(/^[a-z0-9]{1,16}$/i);
    expect(ex[0].sets).toEqual([{ kg: 60, reps: 8 }]);
    expect(r.data.body).toEqual({ '2026-09-28': 79 });
    expect(r.data.food['2026-09-27'].items[0].meal).toBe('ara');
    expect(r.data.goals).toBeNull();
  });

  it('geri yükleme mevcut verilerin yerine geçer', () => {
    const r = ok(JSON.stringify({ app: 'demir-defter', version: 1, data: { body: { '2026-01-01': 90 } } }));
    restoreBackup(r.data);
    expect(store.body).toEqual({ '2026-01-01': 90 });
    expect(store.sessions).toEqual({});
    expect(summarize()).toEqual({ workouts: 0, foodDays: 0, weighIns: 1, templates: 0 });
  });
});
