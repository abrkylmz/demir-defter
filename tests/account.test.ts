// İstemci: API adaptörü, çevrimdışı yazılamayan belgeler ve misafir verisinin hesaba taşınması.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { apiDb, authErrorText, ApiError } from '../src/services/api.ts';
import { cloud, dirtyIds, writeDoc } from '../src/services/db.ts';
import { flushDirty } from '../src/services/persist.ts';
import { mergeGuest } from '../src/services/sync.ts';
import { resetStore, store } from '../src/state/store.ts';
import type { Store } from '../src/types.ts';

type Call = { url: string; method: string; body?: unknown; header?: string | null };

/** Sahte sunucu: /api/docs'u bellekte tutar; `online=false` iken ağ hatası verir. */
function fakeServer() {
  const docs = new Map<string, unknown>();
  const calls: Call[] = [];
  const state = { online: true };
  const fetchMock = vi.fn(async (url: string, init: RequestInit = {}) => {
    if (!state.online) throw new TypeError('Failed to fetch');
    const method = init.method || 'GET';
    const body = init.body ? JSON.parse(String(init.body)) : undefined;
    calls.push({ url, method, body, header: new Headers(init.headers).get('x-demir-defter') });
    const u = new URL(url, 'http://x');
    const id = u.searchParams.get('id')!;
    if (method === 'PUT') docs.set(id, body.data);
    if (method === 'DELETE') docs.delete(id);
    const payload =
      method === 'GET'
        ? {
            docs: [...docs].map(([i, data]) => ({ id: i, data })),
            ids: [...docs.keys()],
            now: new Date().toISOString(),
          }
        : { ok: true };
    return new Response(JSON.stringify(payload), { headers: { 'content-type': 'application/json' } });
  });
  return { docs, calls, state, fetchMock };
}

function memoryStorage() {
  const m = new Map<string, string>();
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, String(v)),
    removeItem: (k: string) => void m.delete(k),
  };
}

let server: ReturnType<typeof fakeServer>;
let onVisible: (() => void) | null = null;

beforeEach(() => {
  server = fakeServer();
  onVisible = null;
  vi.stubGlobal('fetch', server.fetchMock);
  vi.stubGlobal('localStorage', memoryStorage());
  vi.stubGlobal('document', {
    visibilityState: 'visible',
    addEventListener: (_: string, cb: () => void) => (onVisible = cb),
    removeEventListener: () => {},
  });
  vi.stubGlobal('window', { addEventListener: () => {}, removeEventListener: () => {} });
  resetStore();
});
afterEach(() => {
  vi.unstubAllGlobals();
  cloud.mode = 'local';
  cloud.db = null;
  cloud.userId = null;
});

describe('API adaptörü', () => {
  it('yazma ve silme doğru uç noktaya, CSRF başlığıyla gider', async () => {
    const col = apiDb(async () => {}).collection('x');
    await col.doc('body').set({ entries: {} });
    await col.doc('body').delete();
    expect(server.calls.map(c => `${c.method} ${c.url}`)).toEqual([
      'PUT /api/docs?id=body',
      'DELETE /api/docs?id=body',
    ]);
    expect(server.calls.every(c => c.header === '1')).toBe(true);
    expect(server.calls[0].body).toEqual({ data: { entries: {} } });
  });

  it('çekmede eklenen, değişen ve silinen belgeleri bildirir', async () => {
    server.docs.set('body', { v: 1 });
    server.docs.set('settings', { v: 1 });
    const col = apiDb(async () => {}).collection('x');
    await col.get();
    const seen: string[] = [];
    col.onSnapshot(
      s => s.docChanges().forEach(c => seen.push(`${c.type}:${c.doc.id}`)),
      () => {},
    );
    server.docs.set('body', { v: 2 });
    server.docs.delete('settings');
    server.docs.set('nutrition', { v: 1 });
    onVisible!();
    await vi.waitFor(() => expect(seen.length).toBeGreaterThan(0));
    expect(seen.sort()).toEqual(['added:nutrition', 'modified:body', 'removed:settings']);
  });

  it('ağ hatası "unavailable" olur ve Türkçe mesaj verir', async () => {
    server.state.online = false;
    const err = await apiDb(async () => {})
      .collection('x')
      .get()
      .catch(e => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(authErrorText(err)).toBe('İnternet bağlantısı yok gibi görünüyor.');
  });
});

describe('çevrimdışı düzenlemeler', () => {
  it('yazılamayan belge kirli kalır, bağlantı gelince yereldeki son hâliyle gönderilir', async () => {
    cloud.mode = 'cloud';
    cloud.userId = 'u1';
    cloud.db = apiDb(async () => {});
    server.state.online = false;
    store.body = { '2026-09-28': 80 };
    await writeDoc('body', { kind: 'body', entries: store.body });
    expect(dirtyIds()).toEqual(['body']);

    store.body = { '2026-09-28': 79.5 }; // çevrimdışıyken bir düzenleme daha
    server.state.online = true;
    expect(await flushDirty()).toBe(true);
    expect(dirtyIds()).toEqual([]);
    expect(server.docs.get('body')).toMatchObject({ entries: { '2026-09-28': 79.5 } });
  });

  it('bağlantı hâlâ yoksa kirli liste korunur', async () => {
    cloud.mode = 'cloud';
    cloud.userId = 'u1';
    cloud.db = apiDb(async () => {});
    server.state.online = false;
    await writeDoc('settings', { kind: 'settings' });
    expect(await flushDirty()).toBe(false);
    expect(dirtyIds()).toEqual(['settings']);
  });
});

describe('misafir verisini hesaba taşıma', () => {
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
