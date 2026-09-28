import { describe, expect, it } from 'vitest';
import { addDays, mondayOf, parseYmd, ymd } from '../src/lib/date.js';

describe('tarih yardımcıları', () => {
  it('ymd ve parseYmd birbirinin tersi', () => {
    expect(ymd(parseYmd('2026-03-09'))).toBe('2026-03-09');
  });
  it('addDays ay ve yıl sınırını geçer', () => {
    expect(addDays('2026-01-31', 1)).toBe('2026-02-01');
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31');
  });
  it('mondayOf haftanın pazartesisini verir (pazar dahil)', () => {
    expect(mondayOf('2026-09-28')).toBe('2026-09-28'); // pazartesi
    expect(mondayOf('2026-10-04')).toBe('2026-09-28'); // pazar
  });
});
