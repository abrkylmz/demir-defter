import type { SupabaseClient } from '@supabase/supabase-js';
import { beforeEach, describe, expect, it } from 'vitest';
import { authErrorText, supabaseDb } from '../src/services/supabase.ts';
import { mergeGuest } from '../src/services/sync.ts';
import { resetStore, store } from '../src/state/store.ts';
import type { Store } from '../src/types.ts';

/** docs tablosunu bellekte taklit eden, yalnızca adaptörün kullandığı zinciri destekleyen sahte istemci. */
function fakeSupabase() {
  const rows = new Map<string, { user_id: string; id: string; data: unknown }>();
  const calls: string[] = [];
  let realtime: ((p: unknown) => void) | null = null;
  let filter = '';
  const sb = {
    from(table: string) {
      calls.push(`from:${table}`);
      return {
        upsert(row: { user_id: string; id: string; data: unknown }) {
          rows.set(`${row.user_id}/${row.id}`, row);
          return Promise.resolve({ error: null });
        },
        delete() {
          const eqs: Record<string, string> = {};
          const chain = {
            eq(col: string, v: string) {
              eqs[col] = v;
              if (Object.keys(eqs).length === 2) {
                rows.delete(`${eqs.user_id}/${eqs.id}`);
                return Promise.resolve({ error: null });
              }
              return chain;
            },
          };
          return chain;
        },
        select() {
          return {
            eq: (_c: string, uid: string) =>
              Promise.resolve({ data: [...rows.values()].filter(r => r.user_id === uid), error: null }),
          };
        },
      };
    },
    channel: () => ({
      on(_e: string, opts: { filter: string }, cb: (p: unknown) => void) {
        filter = opts.filter;
        realtime = cb;
        return this;
      },
      subscribe() {
        return this;
      },
      unsubscribe() {},
    }),
    removeChannel: () => Promise.resolve(),
  };
  return {
    sb: sb as unknown as SupabaseClient,
    rows,
    calls,
    emit: (p: unknown) => realtime?.(p),
    filter: () => filter,
  };
}

describe('Supabase adaptörü', () => {
  it('yazma, okuma ve silme kullanıcının satırlarıyla sınırlı', async () => {
    const f = fakeSupabase();
    const col = supabaseDb(f.sb, 'u1').collection('x');
    await col.doc('s-2026-09-28').set({ kind: 'session' });
    f.rows.set('u2/body', { user_id: 'u2', id: 'body', data: { secret: true } });
    const snap = await col.get();
    expect(snap.docs.map(d => d.id)).toEqual(['s-2026-09-28']);
    expect(snap.docs[0].data()).toEqual({ kind: 'session' });
    await col.doc('s-2026-09-28').delete();
    expect(f.rows.has('u1/s-2026-09-28')).toBe(false);
    expect(f.rows.has('u2/body')).toBe(true);
  });

  it('canlı olayları belge değişikliğine çevirir, başka kullanıcının silmesini yok sayar', () => {
    const f = fakeSupabase();
    const got: string[] = [];
    supabaseDb(f.sb, 'u1')
      .collection('x')
      .onSnapshot(
        s => s.docChanges().forEach(c => got.push(`${c.type}:${c.doc.id}`)),
        () => {},
      );
    expect(f.filter()).toBe('user_id=eq.u1');
    f.emit({ eventType: 'UPDATE', new: { user_id: 'u1', id: 'body', data: {} } });
    f.emit({ eventType: 'DELETE', old: { user_id: 'u2', id: 'body' } });
    f.emit({ eventType: 'DELETE', old: { user_id: 'u1', id: 's-2026-09-28' } });
    expect(got).toEqual(['modified:body', 'removed:s-2026-09-28']);
  });
});

describe('misafir verisini hesaba taşıma', () => {
  beforeEach(() => resetStore());

  it('hesapta olmayan günler eklenir, çakışmada hesaptaki kalır', () => {
    store.sessions = { '2026-09-01': { date: '2026-09-01', exercises: [], note: 'hesap' } };
    store.body = { '2026-09-01': 80 };
    store.profile = { name: 'Ahmet' };
    const guest: Store = {
      sessions: {
        '2026-09-01': { date: '2026-09-01', exercises: [], note: 'misafir' },
        '2026-09-02': { date: '2026-09-02', exercises: [], note: 'yeni' },
      },
      custom: [{ name: 'Kablo', group: 'Sırt', bar: false }],
      templates: [],
      body: { '2026-09-01': 99, '2026-09-02': 81 },
      food: {},
      foodCustom: [],
      goals: null,
      profile: { name: 'Misafir', weeklyGoal: 5 },
    };
    mergeGuest(guest);
    expect(store.sessions['2026-09-01'].note).toBe('hesap');
    expect(store.sessions['2026-09-02'].note).toBe('yeni');
    expect(store.body).toEqual({ '2026-09-01': 80, '2026-09-02': 81 });
    expect(store.custom).toHaveLength(1);
    expect(store.profile).toEqual({ name: 'Ahmet', weeklyGoal: 5 });
  });
});

describe('hata mesajları', () => {
  it('Supabase hatalarını Türkçeye çevirir', () => {
    expect(authErrorText('Invalid login credentials')).toBe('E-posta ya da şifre hatalı.');
    expect(authErrorText('User already registered')).toMatch(/zaten bir hesap/);
    expect(authErrorText('something odd')).toBe('Bir sorun oluştu, tekrar dene.');
  });
});
