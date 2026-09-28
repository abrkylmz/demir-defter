// Şifre özetleme, oturumlar ve giriş denemesi sınırı. Harici bağımlılık yok: node:crypto.
import { createHash, randomBytes, scrypt, timingSafeEqual, type ScryptOptions } from 'node:crypto';
import type { Db } from './db.js';
import { getCookie, HttpError, SESSION_COOKIE } from './http.js';

export const SESSION_DAYS = 60;
export const MIN_PASSWORD = 8;
const MAX_PASSWORD = 200;

// scrypt parametreleri: N=2^15 (≈32 MB bellek), OWASP önerisiyle uyumlu.
const SCRYPT: ScryptOptions = { N: 1 << 15, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };
const KEY_LEN = 64;

const scryptAsync = (password: string, salt: Buffer, opts: ScryptOptions) =>
  new Promise<Buffer>((resolve, reject) =>
    scrypt(password.normalize('NFKC'), salt, KEY_LEN, opts, (err, key) => (err ? reject(err) : resolve(key))),
  );

/** "scrypt$N$r$p$tuz$özet" biçiminde saklanır; parametreler ileride artırılabilir. */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scryptAsync(password, salt, SCRYPT);
  return ['scrypt', SCRYPT.N, SCRYPT.r, SCRYPT.p, salt.toString('base64'), key.toString('base64')].join('$');
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [alg, n, r, p, salt, hash] = stored.split('$');
  if (alg !== 'scrypt' || !salt || !hash) return false;
  const expected = Buffer.from(hash, 'base64');
  const key = await scryptAsync(password, Buffer.from(salt, 'base64'), {
    N: Number(n),
    r: Number(r),
    p: Number(p),
    maxmem: SCRYPT.maxmem,
  });
  return key.length === expected.length && timingSafeEqual(key, expected);
}

/** Zamanlama saldırısına karşı: kullanıcı yoksa da aynı süre harcanır. */
let dummyHash: Promise<string> | null = null;
export async function burnTime(password: string): Promise<void> {
  dummyHash ??= hashPassword('zamanlama-dengesi');
  await verifyPassword(password, await dummyHash);
}

export const randomToken = (): string => randomBytes(32).toString('base64url');
/** Veritabanında belirteçlerin kendisi değil özeti tutulur; sızıntıda oturum çalınamaz. */
export const tokenHash = (token: string): string => createHash('sha256').update(token).digest('base64url');

export function validateEmail(v: unknown): string {
  const email = typeof v === 'string' ? v.trim().toLowerCase() : '';
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    throw new HttpError(400, 'invalid_email');
  return email;
}

export function validatePassword(v: unknown): string {
  const password = typeof v === 'string' ? v : '';
  if (password.length < MIN_PASSWORD) throw new HttpError(400, 'weak_password');
  if (password.length > MAX_PASSWORD) throw new HttpError(400, 'invalid_password');
  return password;
}

export interface UserRow {
  id: string;
  email: string;
  name: string;
}

export async function createSession(db: Db, userId: string): Promise<string> {
  const token = randomToken();
  await db.query(
    `insert into sessions (token_hash, user_id, expires_at) values ($1, $2, now() + $3::interval)`,
    [tokenHash(token), userId, `${SESSION_DAYS} days`],
  );
  // Arada bir süresi dolmuş oturumları temizle
  if (Math.random() < 0.05) await db.query(`delete from sessions where expires_at < now()`);
  return token;
}

/** Çerezdeki oturuma ait kullanıcı; yoksa ya da süresi dolduysa null. */
export async function sessionUser(db: Db, req: Request): Promise<UserRow | null> {
  const token = getCookie(req, SESSION_COOKIE);
  if (!token) return null;
  const rows = await db.query<UserRow>(
    `select u.id, u.email, u.name from sessions s join users u on u.id = s.user_id
     where s.token_hash = $1 and s.expires_at > now()`,
    [tokenHash(token)],
  );
  return rows[0] ?? null;
}

export async function requireUser(db: Db, req: Request): Promise<UserRow> {
  const u = await sessionUser(db, req);
  if (!u) throw new HttpError(401, 'unauthorized');
  return u;
}

// ---------- giriş denemesi sınırı ----------

const WINDOW_MIN = 15;
const MAX_ATTEMPTS = 10;

/** Aynı anahtar (ör. e-posta) için 15 dakikada en fazla 10 başarısız deneme. */
export async function assertNotLocked(db: Db, key: string): Promise<void> {
  const rows = await db.query<{ count: number }>(
    `select count from login_attempts where key = $1 and window_start > now() - $2::interval`,
    [key, `${WINDOW_MIN} minutes`],
  );
  if (rows[0] && rows[0].count >= MAX_ATTEMPTS) throw new HttpError(429, 'too_many_attempts');
}

export async function recordFailure(db: Db, key: string): Promise<void> {
  await db.query(
    `insert into login_attempts (key, count, window_start) values ($1, 1, now())
     on conflict (key) do update set
       count = case when login_attempts.window_start > now() - $2::interval then login_attempts.count + 1 else 1 end,
       window_start = case when login_attempts.window_start > now() - $2::interval then login_attempts.window_start else now() end`,
    [key, `${WINDOW_MIN} minutes`],
  );
}

export const clearFailures = (db: Db, key: string) =>
  db.query(`delete from login_attempts where key = $1`, [key]);
