// API uç noktaları gerçek bir Postgres'e (PGlite, süreç içi) karşı test edilir.
import { PGlite } from '@electric-sql/pglite';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import * as auth from '../api/auth.ts';
import { hashPassword, verifyPassword } from '../api/_lib/auth.ts';
import { databaseUrl, setDb, type Db } from '../api/_lib/db.ts';
import * as docs from '../api/docs.ts';
import * as foodPhoto from '../api/food-photo.ts';
import { setFoodModel, type FoodModelResult } from '../api/_lib/food-ai.ts';

const ORIGIN = 'http://localhost:3000';
let pg: PGlite;

beforeAll(async () => {
  pg = new PGlite();
  const db: Db = {
    query: async <T>(text: string, params: unknown[] = []) => (await pg.query<T>(text, params)).rows,
  };
  setDb(db);
});
beforeEach(async () => {
  // Şema ilk istekte oluşur; her testten önce tabloları boşalt
  await auth.GET(new Request(`${ORIGIN}/api/auth`));
  await pg.exec('truncate users, sessions, docs, login_attempts, password_resets, ai_usage cascade');
});

type Opts = { method?: string; body?: unknown; cookie?: string; client?: boolean; origin?: string };
function req(path: string, { method = 'GET', body, cookie, client = true, origin = ORIGIN }: Opts = {}) {
  const headers: Record<string, string> = { origin };
  if (client) headers['x-demir-defter'] = '1';
  if (cookie) headers.cookie = cookie;
  if (body !== undefined) headers['content-type'] = 'application/json';
  return new Request(`${ORIGIN}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}
const cookieOf = (res: Response) => (res.headers.get('set-cookie') || '').split(';')[0];

async function signup(name = 'Ahmet', email = 'ahmet@ornek.com', password = 'guclusifre1') {
  const res = await auth.POST(
    req('/api/auth?action=signup', { method: 'POST', body: { name, email, password } }),
  );
  return { res, cookie: cookieOf(res), body: await res.json() };
}

describe('şifre özetleme', () => {
  it('doğru şifre eşleşir, yanlışı eşleşmez; özet düz metin içermez', async () => {
    const h = await hashPassword('guclusifre1');
    expect(h).toMatch(/^scrypt\$32768\$8\$1\$/);
    expect(h).not.toContain('guclusifre1');
    expect(await verifyPassword('guclusifre1', h)).toBe(true);
    expect(await verifyPassword('guclusifre2', h)).toBe(false);
  });
});

describe('/api/auth', () => {
  it('kayıt: oturum çerezi HttpOnly, SameSite ve şifre saklanmaz', async () => {
    const { res, body } = await signup();
    expect(res.status).toBe(201);
    expect(body.user).toMatchObject({ name: 'Ahmet', email: 'ahmet@ornek.com' });
    const setCookie = res.headers.get('set-cookie')!;
    expect(setCookie).toMatch(/dd_session=.+; Path=\/; HttpOnly; SameSite=Lax/);
    const [row] = (await pg.query<{ password_hash: string }>('select password_hash from users')).rows;
    expect(row.password_hash.startsWith('scrypt$')).toBe(true);
    const [s] = (await pg.query<{ token_hash: string }>('select token_hash from sessions')).rows;
    expect(setCookie).not.toContain(s.token_hash); // veritabanında belirtecin özeti var, kendisi değil
  });

  it('aynı e-posta (büyük/küçük harf farkıyla) ikinci kez kayıt olamaz', async () => {
    await signup();
    const r = await auth.POST(
      req('/api/auth?action=signup', {
        method: 'POST',
        body: { name: 'X', email: 'AHMET@ornek.com', password: 'baskasifre1' },
      }),
    );
    expect(r.status).toBe(409);
    expect(await r.json()).toEqual({ error: 'email_taken' });
  });

  it('zayıf şifre ve geçersiz e-posta reddedilir', async () => {
    const weak = await auth.POST(
      req('/api/auth?action=signup', {
        method: 'POST',
        body: { name: 'A', email: 'a@b.co', password: '123' },
      }),
    );
    expect((await weak.json()).error).toBe('weak_password');
    const bad = await auth.POST(
      req('/api/auth?action=signup', {
        method: 'POST',
        body: { name: 'A', email: 'yok', password: '12345678' },
      }),
    );
    expect((await bad.json()).error).toBe('invalid_email');
  });

  it('me: çerezle kullanıcıyı döner, çerezsiz null', async () => {
    const { cookie } = await signup();
    expect((await (await auth.GET(req('/api/auth', { cookie }))).json()).user.name).toBe('Ahmet');
    expect((await (await auth.GET(req('/api/auth'))).json()).user).toBeNull();
  });

  it('giriş: yanlış şifre 401, doğru şifre yeni oturum', async () => {
    await signup();
    const wrong = await auth.POST(
      req('/api/auth?action=login', {
        method: 'POST',
        body: { email: 'ahmet@ornek.com', password: 'yanlis' },
      }),
    );
    expect(wrong.status).toBe(401);
    const ok = await auth.POST(
      req('/api/auth?action=login', {
        method: 'POST',
        body: { email: 'Ahmet@Ornek.com', password: 'guclusifre1' },
      }),
    );
    expect(ok.status).toBe(200);
    expect(cookieOf(ok)).toMatch(/^dd_session=/);
  });

  it('10 başarısız denemeden sonra doğru şifre de geçici olarak kilitlenir', async () => {
    await signup();
    for (let i = 0; i < 10; i++)
      await auth.POST(
        req('/api/auth?action=login', {
          method: 'POST',
          body: { email: 'ahmet@ornek.com', password: 'yanlis' },
        }),
      );
    const r = await auth.POST(
      req('/api/auth?action=login', {
        method: 'POST',
        body: { email: 'ahmet@ornek.com', password: 'guclusifre1' },
      }),
    );
    expect(r.status).toBe(429);
  });

  it('çıkış oturumu sunucuda da siler', async () => {
    const { cookie } = await signup();
    await auth.POST(req('/api/auth?action=logout', { method: 'POST', cookie, body: {} }));
    expect((await (await auth.GET(req('/api/auth', { cookie }))).json()).user).toBeNull();
  });

  it('CSRF: uygulama başlığı olmayan ya da başka kökenden gelen istek reddedilir', async () => {
    const noHeader = await auth.POST(
      req('/api/auth?action=signup', { method: 'POST', client: false, body: {} }),
    );
    expect(noHeader.status).toBe(403);
    const evil = await auth.POST(
      req('/api/auth?action=logout', { method: 'POST', origin: 'https://kotu.site', body: {} }),
    );
    expect(evil.status).toBe(403);
  });

  it('şifre sıfırlama e-posta servisi yokken kapalı', async () => {
    delete process.env.RESEND_API_KEY;
    expect((await (await auth.GET(req('/api/auth'))).json()).reset).toBe(false);
    const r = await auth.POST(
      req('/api/auth?action=reset-request', { method: 'POST', body: { email: 'a@b.co' } }),
    );
    expect(r.status).toBe(404);
  });
});

describe('/api/docs', () => {
  const put = (cookie: string, id: string, data: unknown) =>
    docs.PUT(req(`/api/docs?id=${id}`, { method: 'PUT', cookie, body: { data } }));

  it('yazma, okuma, silme', async () => {
    const { cookie } = await signup();
    expect((await put(cookie, 's-2026-09-28', { kind: 'session', exercises: [] })).status).toBe(200);
    expect((await put(cookie, 'body', { entries: { '2026-09-28': 80 } })).status).toBe(200);
    const all = await (await docs.GET(req('/api/docs', { cookie }))).json();
    expect(all.ids.sort()).toEqual(['body', 's-2026-09-28']);
    expect(all.docs.find((d: { id: string }) => d.id === 'body').data).toEqual({
      entries: { '2026-09-28': 80 },
    });
    await docs.DELETE(req('/api/docs?id=body', { method: 'DELETE', cookie }));
    expect((await (await docs.GET(req('/api/docs', { cookie }))).json()).ids).toEqual(['s-2026-09-28']);
  });

  it('since: yalnızca sonradan değişenler gelir, kimlik listesi silinenleri gösterir', async () => {
    const { cookie } = await signup();
    await put(cookie, 'body', { v: 1 });
    const first = await (await docs.GET(req('/api/docs', { cookie }))).json();
    await new Promise(r => setTimeout(r, 20));
    await put(cookie, 'settings', { v: 2 });
    const next = await (
      await docs.GET(req(`/api/docs?since=${encodeURIComponent(first.now)}`, { cookie }))
    ).json();
    expect(next.docs.map((d: { id: string }) => d.id)).toEqual(['settings']);
    expect(next.ids.sort()).toEqual(['body', 'settings']);
  });

  it('kullanıcılar birbirinin belgelerini göremez ve silemez', async () => {
    const a = await signup('Ahmet', 'ahmet@ornek.com');
    const b = await signup('Ayşe', 'ayse@ornek.com');
    await put(a.cookie, 'body', { gizli: true });
    const bDocs = await (await docs.GET(req('/api/docs', { cookie: b.cookie }))).json();
    expect(bDocs.ids).toEqual([]);
    await docs.DELETE(req('/api/docs?id=body', { method: 'DELETE', cookie: b.cookie }));
    expect((await (await docs.GET(req('/api/docs', { cookie: a.cookie }))).json()).ids).toEqual(['body']);
  });

  it('oturumsuz 401, geçersiz kimlik ve dizi veri 400', async () => {
    expect((await docs.GET(req('/api/docs'))).status).toBe(401);
    const { cookie } = await signup();
    expect((await put(cookie, 'users', { x: 1 })).status).toBe(400);
    expect((await put(cookie, "s-2026-09-28'; drop table docs;--", { x: 1 })).status).toBe(400);
    expect((await put(cookie, 'body', [1, 2])).status).toBe(400);
  });
});

describe('veritabanı adresi', () => {
  const pgUrl = 'postgresql://u:p@ep-x.eu-central-1.aws.neon.tech/neondb';
  it('DATABASE_URL öncelikli, önekli adlar da bulunur, UNPOOLED ve postgres olmayanlar atlanır', () => {
    expect(databaseUrl({ DATABASE_URL: pgUrl })).toBe(pgUrl);
    expect(databaseUrl({ STORAGE_DATABASE_URL: pgUrl, STORAGE_DATABASE_URL_UNPOOLED: 'x' })).toBe(pgUrl);
    expect(databaseUrl({ OTHER_URL: pgUrl, DATABASE_URL: 'mysql://x' })).toBeUndefined();
    expect(databaseUrl({})).toBeUndefined();
  });
});

describe('hesap silme', () => {
  it('yanlış şifreyle silinmez; doğru şifreyle kullanıcı, oturumları ve belgeleri silinir', async () => {
    const { cookie } = await signup();
    await docs.PUT(req('/api/docs?id=body', { method: 'PUT', cookie, body: { data: { v: 1 } } }));
    const wrong = await auth.POST(
      req('/api/auth?action=delete', { method: 'POST', cookie, body: { password: 'yanlis' } }),
    );
    expect(wrong.status).toBe(401);
    const ok = await auth.POST(
      req('/api/auth?action=delete', { method: 'POST', cookie, body: { password: 'guclusifre1' } }),
    );
    expect(ok.status).toBe(200);
    for (const t of ['users', 'sessions', 'docs'])
      expect((await pg.query<{ n: number }>(`select count(*)::int as n from ${t}`)).rows[0].n).toBe(0);
  });
  it('oturumsuz silme isteği reddedilir', async () => {
    const r = await auth.POST(req('/api/auth?action=delete', { method: 'POST', body: { password: 'x' } }));
    expect(r.status).toBe(401);
  });
});

describe('/api/food-photo', () => {
  const IMG =
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
  const ok: FoodModelResult = {
    ok: true,
    data: {
      is_food: true,
      note: 'Pilav porsiyonu tabağa göre tahmin edildi.',
      items: [
        {
          name: 'Pirinç pilavı',
          match: 'Pirinç pilavı (tereyağlı)',
          grams: 180,
          kcal: 165,
          protein: 3,
          carbs: 30,
          fat: 3.5,
          confidence: 'high',
        },
        {
          name: 'Tavuk sote',
          match: 'Uydurma besin',
          grams: 99999,
          kcal: -5,
          protein: 25,
          carbs: 4,
          fat: 8,
          confidence: 'medium',
        },
      ],
    },
  };
  const send = (
    cookie: string | undefined,
    body: unknown = { image: IMG, mediaType: 'image/png', known: ['Pirinç pilavı (tereyağlı)'] },
  ) => foodPhoto.POST(req('/api/food-photo', { method: 'POST', cookie, body }));

  beforeEach(() => {
    process.env.ANTHROPIC_API_KEY = 'test';
    setFoodModel(async () => ok);
  });

  it('anahtar yoksa kapalı; durum uç noktası bunu bildirir', async () => {
    delete process.env.ANTHROPIC_API_KEY;
    const { cookie } = await signup();
    expect((await send(cookie)).status).toBe(503);
    expect((await (await auth.GET(req('/api/auth'))).json()).ai).toBe(false);
  });

  it('oturumsuz ve CSRF başlıksız istekler reddedilir', async () => {
    expect((await send(undefined)).status).toBe(401);
    const { cookie } = await signup();
    const r = await foodPhoto.POST(
      req('/api/food-photo', { method: 'POST', cookie, client: false, body: {} }),
    );
    expect(r.status).toBe(403);
  });

  it('geçersiz görsel reddedilir, model çağrılmaz', async () => {
    let called = false;
    setFoodModel(async () => ((called = true), ok));
    const { cookie } = await signup();
    expect((await send(cookie, { image: 'not base64!', mediaType: 'image/png' })).status).toBe(400);
    expect((await send(cookie, { image: IMG, mediaType: 'image/gif' })).status).toBe(400);
    expect(called).toBe(false);
  });

  it('model çıktısı temizlenir: listede olmayan eşleşme atılır, sayılar sınırlanır', async () => {
    const { cookie } = await signup();
    const r = await send(cookie);
    expect(r.status).toBe(200);
    const body = await r.json();
    expect(body.isFood).toBe(true);
    expect(body.items[0]).toMatchObject({
      name: 'Pirinç pilavı',
      match: 'Pirinç pilavı (tereyağlı)',
      grams: 180,
    });
    expect(body.items[1]).toMatchObject({ match: null, grams: 2000, per: { k: 0, p: 25 } });
    expect(body.remaining).toBe(29);
  });

  it('günlük sınır aşılınca 429; başarısız analiz hak yemez', async () => {
    const { cookie } = await signup();
    setFoodModel(async () => ({ ok: false, reason: 'error' }));
    expect((await send(cookie)).status).toBe(502);
    setFoodModel(async () => ok);
    let last: Response | null = null;
    for (let i = 0; i < foodPhoto.DAILY_LIMIT; i++) last = await send(cookie);
    expect(last!.status).toBe(200);
    expect((await last!.json()).remaining).toBe(0);
    const over = await send(cookie);
    expect(over.status).toBe(429);
    expect((await over.json()).error).toBe('daily_limit');
  });

  it('model reddederse 422', async () => {
    setFoodModel(async () => ({ ok: false, reason: 'refused' }));
    const { cookie } = await signup();
    expect((await send(cookie)).status).toBe(422);
  });
});
