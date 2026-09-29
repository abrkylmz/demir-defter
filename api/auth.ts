// /api/auth?action=…  — me | signup | login | logout | reset-request | reset
import {
  assertNotLocked,
  burnTime,
  clearFailures,
  createSession,
  hashPassword,
  randomToken,
  recordFailure,
  SESSION_DAYS,
  sessionUser,
  tokenHash,
  validateEmail,
  validatePassword,
  verifyPassword,
  type UserRow,
} from './_lib/auth.js';
import { getDb, type Db } from './_lib/db.js';
import {
  assertClientRequest,
  errorResponse,
  getCookie,
  HttpError,
  json,
  readJson,
  SESSION_COOKIE,
  sessionCookie,
} from './_lib/http.js';
import { aiEnabled } from './_lib/food-ai.js';
import { mailEnabled, sendResetEmail } from './_lib/mail.js';

const RESET_MINUTES = 60;
const publicUser = (u: UserRow) => ({ id: u.id, email: u.email, name: u.name });

async function db(): Promise<Db> {
  const d = await getDb();
  if (!d) throw new HttpError(503, 'not_configured');
  return d;
}

async function loggedIn(req: Request, d: Db, user: UserRow, status = 200): Promise<Response> {
  const token = await createSession(d, user.id);
  return json({ user: publicUser(user) }, status, {
    'set-cookie': sessionCookie(req, token, SESSION_DAYS * 86400),
  });
}

/** Oturum durumu ve sunucu özellikleri. Uygulama açılışta bununla hesap sisteminin açık olup olmadığını anlar. */
export async function GET(req: Request): Promise<Response> {
  try {
    const d = await db();
    const user = await sessionUser(d, req);
    return json({ user: user ? publicUser(user) : null, reset: mailEnabled(), ai: aiEnabled() });
  } catch (e) {
    return errorResponse(e);
  }
}

export async function POST(req: Request): Promise<Response> {
  try {
    assertClientRequest(req);
    const action = new URL(req.url).searchParams.get('action');
    const body = await readJson(req);
    const d = await db();

    if (action === 'signup') {
      const name = typeof body.name === 'string' ? body.name.trim().slice(0, 40) : '';
      if (!name) throw new HttpError(400, 'name_required');
      const email = validateEmail(body.email);
      const password = validatePassword(body.password);
      const hash = await hashPassword(password);
      const rows = await d.query<UserRow>(
        `insert into users (email, password_hash, name) values ($1, $2, $3)
         on conflict ((lower(email))) do nothing returning id, email, name`,
        [email, hash, name],
      );
      if (!rows[0]) throw new HttpError(409, 'email_taken');
      return loggedIn(req, d, rows[0], 201);
    }

    if (action === 'login') {
      const email = validateEmail(body.email);
      const password = typeof body.password === 'string' ? body.password : '';
      await assertNotLocked(d, `login:${email}`);
      const rows = await d.query<UserRow & { password_hash: string }>(
        `select id, email, name, password_hash from users where lower(email) = $1`,
        [email],
      );
      const u = rows[0];
      const ok = u ? await verifyPassword(password, u.password_hash) : (await burnTime(password), false);
      if (!u || !ok) {
        await recordFailure(d, `login:${email}`);
        throw new HttpError(401, 'invalid_credentials');
      }
      await clearFailures(d, `login:${email}`);
      return loggedIn(req, d, u);
    }

    if (action === 'logout') {
      const token = getCookie(req, SESSION_COOKIE);
      if (token) await d.query(`delete from sessions where token_hash = $1`, [tokenHash(token)]);
      return json({ ok: true }, 200, { 'set-cookie': sessionCookie(req, null, 0) });
    }

    if (action === 'reset-request') {
      if (!mailEnabled()) throw new HttpError(404, 'reset_disabled');
      const email = validateEmail(body.email);
      await assertNotLocked(d, `reset:${email}`);
      await recordFailure(d, `reset:${email}`); // gönderim sayısını da sınırla
      const rows = await d.query<UserRow>(`select id, email, name from users where lower(email) = $1`, [
        email,
      ]);
      if (rows[0]) {
        const token = randomToken();
        await d.query(
          `insert into password_resets (token_hash, user_id, expires_at) values ($1, $2, now() + $3::interval)`,
          [tokenHash(token), rows[0].id, `${RESET_MINUTES} minutes`],
        );
        const link = `${new URL(req.url).origin}/?reset=${encodeURIComponent(token)}`;
        await sendResetEmail(rows[0].email, rows[0].name, link);
      }
      // Hesap var mı yok mu belli etmemek için her durumda aynı yanıt
      return json({ ok: true });
    }

    if (action === 'reset') {
      const token = typeof body.token === 'string' ? body.token : '';
      const password = validatePassword(body.password);
      const rows = await d.query<UserRow>(
        `delete from password_resets r using users u
         where r.token_hash = $1 and r.expires_at > now() and u.id = r.user_id
         returning u.id, u.email, u.name`,
        [tokenHash(token)],
      );
      const u = rows[0];
      if (!u) throw new HttpError(400, 'invalid_token');
      await d.query(`update users set password_hash = $1 where id = $2`, [
        await hashPassword(password),
        u.id,
      ]);
      // Şifre değişince tüm eski oturumlar kapanır
      await d.query(`delete from sessions where user_id = $1`, [u.id]);
      return loggedIn(req, d, u);
    }

    if (action === 'delete') {
      // Hesap ve tüm verisi kalıcı olarak silinir (oturumlar ve belgeler cascade ile gider). Şifre onayı gerekir.
      const u = await sessionUser(d, req);
      if (!u) throw new HttpError(401, 'unauthorized');
      const password = typeof body.password === 'string' ? body.password : '';
      await assertNotLocked(d, `delete:${u.id}`);
      const [row] = await d.query<{ password_hash: string }>(
        `select password_hash from users where id = $1`,
        [u.id],
      );
      if (!row || !(await verifyPassword(password, row.password_hash))) {
        await recordFailure(d, `delete:${u.id}`);
        throw new HttpError(401, 'invalid_credentials');
      }
      await d.query(`delete from users where id = $1`, [u.id]);
      await clearFailures(d, `delete:${u.id}`);
      return json({ ok: true }, 200, { 'set-cookie': sessionCookie(req, null, 0) });
    }

    throw new HttpError(404, 'unknown_action');
  } catch (e) {
    return errorResponse(e);
  }
}
