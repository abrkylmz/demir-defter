// /api/food-photo — yemek fotoğrafından besin tahmini. Yalnızca giriş yapmış kullanıcılar; günlük sınır var.
//   POST { image: base64, mediaType, known: string[] } → { isFood, items, note, remaining }
// Fotoğraf saklanmaz; yalnızca tahmin için modele gönderilir.
import { requireUser } from './_lib/auth.js';
import { getDb, type Db } from './_lib/db.js';
import { aiEnabled, analyzeFoodPhoto, cleanEstimate, type FoodPhotoInput } from './_lib/food-ai.js';
import { assertClientRequest, errorResponse, HttpError, json, readJson } from './_lib/http.js';

/** Kullanıcı başına günlük analiz sınırı (maliyet koruması). */
export const DAILY_LIMIT = 30;
const MAX_IMAGE_B64 = 560 * 1024; // istemci 1024 px JPEG'e küçültür (~100–250 KB)
const MEDIA = new Set(['image/jpeg', 'image/png', 'image/webp']);
const MAX_KNOWN = 300;

async function db(): Promise<Db> {
  const d = await getDb();
  if (!d) throw new HttpError(503, 'not_configured');
  return d;
}

/** Bugünkü sayacı bir artırır; yeni değeri döner (atomik). */
async function bumpUsage(d: Db, userId: string, delta: 1 | -1): Promise<number> {
  const [row] = await d.query<{ count: number }>(
    `insert into ai_usage (user_id, day, count) values ($1, current_date, greatest($2, 0))
     on conflict (user_id, day) do update set count = greatest(ai_usage.count + $2, 0)
     returning count`,
    [userId, delta],
  );
  return row.count;
}

function parseInput(body: Record<string, unknown>): FoodPhotoInput {
  const image = typeof body.image === 'string' ? body.image : '';
  const mediaType = typeof body.mediaType === 'string' ? body.mediaType : '';
  if (!image || image.length > MAX_IMAGE_B64 || !/^[A-Za-z0-9+/]+=*$/.test(image))
    throw new HttpError(400, 'invalid_image');
  if (!MEDIA.has(mediaType)) throw new HttpError(400, 'invalid_image');
  const known = (Array.isArray(body.known) ? body.known : [])
    .filter((n): n is string => typeof n === 'string' && n.trim().length > 0)
    .map(n => n.trim().slice(0, 60))
    .slice(0, MAX_KNOWN);
  return { image, mediaType: mediaType as FoodPhotoInput['mediaType'], known };
}

export async function POST(req: Request): Promise<Response> {
  try {
    assertClientRequest(req);
    if (!aiEnabled()) throw new HttpError(503, 'ai_not_configured');
    const input = parseInput(await readJson(req));
    const d = await db();
    const user = await requireUser(d, req);

    // Önce say, sınırı aşarsa geri al: eşzamanlı isteklerde de sınır tutarlı kalır.
    const used = await bumpUsage(d, user.id, 1);
    if (used > DAILY_LIMIT) {
      await bumpUsage(d, user.id, -1);
      throw new HttpError(429, 'daily_limit');
    }

    const result = await analyzeFoodPhoto(input);
    if (!result.ok) {
      await bumpUsage(d, user.id, -1); // başarısız analiz hakkı yemesin
      const status = result.reason === 'refused' ? 422 : result.reason === 'busy' ? 503 : 502;
      throw new HttpError(status, `ai_${result.reason}`);
    }
    return json({ ...cleanEstimate(result.data, input.known), remaining: DAILY_LIMIT - used });
  } catch (e) {
    return errorResponse(e);
  }
}
