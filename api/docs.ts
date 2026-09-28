// /api/docs — kullanıcının belgeleri. Uygulamanın belge modeli: s-<tarih>, f-<tarih>, body, settings, nutrition.
//   GET  ?since=<iso>  → değişen belgeler + tüm kimlikler (silinenleri anlamak için) + sunucu zamanı
//   PUT  ?id=<id>      → { data } yaz
//   DELETE ?id=<id>    → sil
// Her sorgu oturumdaki kullanıcıyla sınırlıdır; başka kullanıcının belgesine erişim yolu yoktur.
import { requireUser } from './_lib/auth.js';
import { getDb, type Db } from './_lib/db.js';
import { assertClientRequest, errorResponse, HttpError, json, readJson } from './_lib/http.js';

const ID_RE = /^(s-\d{4}-\d{2}-\d{2}|f-\d{4}-\d{2}-\d{2}|body|settings|nutrition)$/;
const MAX_DOC_BYTES = 512 * 1024;
const MAX_DOCS_PER_USER = 20000;

async function db(): Promise<Db> {
  const d = await getDb();
  if (!d) throw new HttpError(503, 'not_configured');
  return d;
}

function docId(req: Request): string {
  const id = new URL(req.url).searchParams.get('id') || '';
  if (!ID_RE.test(id)) throw new HttpError(400, 'invalid_id');
  return id;
}

interface DocRow {
  id: string;
  data: unknown;
  updated_at: string;
}

export async function GET(req: Request): Promise<Response> {
  try {
    const d = await db();
    const user = await requireUser(d, req);
    const since = new URL(req.url).searchParams.get('since');
    const sinceTime = since && !Number.isNaN(Date.parse(since)) ? since : null;
    const [now] = await d.query<{ now: string }>(`select now()::text as now`);
    const docs = await d.query<DocRow>(
      sinceTime
        ? `select id, data, updated_at from docs where user_id = $1 and updated_at > $2`
        : `select id, data, updated_at from docs where user_id = $1`,
      sinceTime ? [user.id, sinceTime] : [user.id],
    );
    const ids = sinceTime
      ? (await d.query<{ id: string }>(`select id from docs where user_id = $1`, [user.id])).map(r => r.id)
      : docs.map(r => r.id);
    return json({ docs: docs.map(r => ({ id: r.id, data: r.data })), ids, now: now.now });
  } catch (e) {
    return errorResponse(e);
  }
}

export async function PUT(req: Request): Promise<Response> {
  try {
    assertClientRequest(req);
    const id = docId(req);
    const body = await readJson<{ data?: unknown }>(req);
    const data = body.data;
    if (data === null || typeof data !== 'object' || Array.isArray(data))
      throw new HttpError(400, 'invalid_data');
    const text = JSON.stringify(data);
    if (text.length > MAX_DOC_BYTES) throw new HttpError(413, 'too_large');
    const d = await db();
    const user = await requireUser(d, req);
    const rows = await d.query<{ n: number }>(
      `with up as (
         insert into docs (user_id, id, data, updated_at)
         select $1, $2, $3::jsonb, now()
         where exists (select 1 from docs where user_id = $1 and id = $2)
            or (select count(*) from docs where user_id = $1) < $4
         on conflict (user_id, id) do update set data = excluded.data, updated_at = now()
         returning 1
       ) select count(*)::int as n from up`,
      [user.id, id, text, MAX_DOCS_PER_USER],
    );
    if (!rows[0] || rows[0].n === 0) throw new HttpError(413, 'too_many_docs');
    return json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}

export async function DELETE(req: Request): Promise<Response> {
  try {
    assertClientRequest(req);
    const id = docId(req);
    const d = await db();
    const user = await requireUser(d, req);
    await d.query(`delete from docs where user_id = $1 and id = $2`, [user.id, id]);
    return json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
