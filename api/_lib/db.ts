// Veritabanı erişimi. Üretimde Neon (HTTP sürücüsü), testlerde PGlite (süreç içi Postgres).
// Tablolar ilk istekte kendiliğinden oluşturulur; ayrıca SQL çalıştırmak gerekmez.
import { neon } from '@neondatabase/serverless';

export interface Db {
  query<T = Record<string, unknown>>(text: string, params?: unknown[]): Promise<T[]>;
}

/** Şema: tekrar çalıştırılması güvenli (IF NOT EXISTS). Değişiklikleri yalnızca ekleyerek yap. */
export const SCHEMA = [
  `create table if not exists users (
     id uuid primary key default gen_random_uuid(),
     email text not null,
     password_hash text not null,
     name text not null default '',
     created_at timestamptz not null default now()
   )`,
  `create unique index if not exists users_email_key on users (lower(email))`,
  `create table if not exists sessions (
     token_hash text primary key,
     user_id uuid not null references users (id) on delete cascade,
     expires_at timestamptz not null
   )`,
  `create index if not exists sessions_user_idx on sessions (user_id)`,
  `create table if not exists docs (
     user_id uuid not null references users (id) on delete cascade,
     id text not null,
     data jsonb not null,
     updated_at timestamptz not null default now(),
     primary key (user_id, id)
   )`,
  `create index if not exists docs_updated_idx on docs (user_id, updated_at)`,
  `create table if not exists login_attempts (
     key text primary key,
     count int not null,
     window_start timestamptz not null
   )`,
  `create table if not exists password_resets (
     token_hash text primary key,
     user_id uuid not null references users (id) on delete cascade,
     expires_at timestamptz not null
   )`,
  `create table if not exists ai_usage (
     user_id uuid not null references users (id) on delete cascade,
     day date not null,
     count int not null,
     primary key (user_id, day)
   )`,
];

let db: Db | null = null;
let schemaReady: Promise<void> | null = null;

/**
 * Bağlantı adresi. Vercel'in Neon entegrasyonu DATABASE_URL ekler; bağlarken önek seçildiyse
 * (ör. STORAGE_DATABASE_URL) onu da bulur. Havuzlanmamış (UNPOOLED) adresler tercih edilmez.
 */
export function databaseUrl(env: Record<string, string | undefined> = process.env): string | undefined {
  const isPg = (v?: string) => !!v && /^postgres(ql)?:\/\//.test(v);
  for (const k of ['DATABASE_URL', 'POSTGRES_URL', 'NEON_DATABASE_URL']) if (isPg(env[k])) return env[k];
  const key = Object.keys(env)
    .filter(k => /(^|_)(DATABASE|POSTGRES)_URL$/.test(k) && isPg(env[k]))
    .sort()[0];
  return key ? env[key] : undefined;
}

/** Testler için sahte ya da süreç içi veritabanı verir. */
export function setDb(d: Db | null): void {
  db = d;
  schemaReady = null;
}

function neonDb(url: string): Db {
  const sql = neon(url);
  return { query: async <T>(text: string, params: unknown[] = []) => (await sql.query(text, params)) as T[] };
}

/** Şeması hazır veritabanı; yapılandırılmamışsa null. */
export async function getDb(): Promise<Db | null> {
  if (!db) {
    const url = databaseUrl();
    if (!url) return null;
    db = neonDb(url);
  }
  const d = db;
  schemaReady ??= (async () => {
    for (const stmt of SCHEMA) await d.query(stmt);
  })().catch(e => {
    schemaReady = null; // bir sonraki istekte tekrar dene
    throw e;
  });
  await schemaReady;
  return d;
}
