// Web standardı Request/Response yardımcıları (Vercel Functions, Node çalışma zamanı).

export const SESSION_COOKIE = 'dd_session';
/** Tarayıcıdan gelen değiştirici isteklerde zorunlu başlık (CSRF'e karşı; başka site bu başlığı gönderemez). */
export const CLIENT_HEADER = 'x-demir-defter';
const MAX_BODY = 600 * 1024;

export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
  ) {
    super(code);
  }
}

export function json(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...headers },
  });
}

export const errorResponse = (e: unknown): Response => {
  if (e instanceof HttpError) return json({ error: e.code }, e.status);
  console.error(e);
  return json({ error: 'server_error' }, 500);
};

/** Değiştirici istekler: aynı kökenden ve uygulamanın başlığıyla gelmeli. */
export function assertClientRequest(req: Request): void {
  if (req.headers.get(CLIENT_HEADER) !== '1') throw new HttpError(403, 'forbidden');
  const origin = req.headers.get('origin');
  if (origin && origin !== new URL(req.url).origin) throw new HttpError(403, 'forbidden');
}

export async function readJson<T = Record<string, unknown>>(req: Request): Promise<T> {
  const text = await req.text();
  if (text.length > MAX_BODY) throw new HttpError(413, 'too_large');
  try {
    const v = JSON.parse(text || '{}');
    if (v === null || typeof v !== 'object' || Array.isArray(v)) throw new Error();
    return v as T;
  } catch {
    throw new HttpError(400, 'bad_json');
  }
}

export function getCookie(req: Request, name: string): string | null {
  const header = req.headers.get('cookie') || '';
  for (const part of header.split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === name) return decodeURIComponent(v.join('='));
  }
  return null;
}

/** Oturum çerezi: JavaScript okuyamaz, yalnızca HTTPS'te ve aynı siteden gönderilir. */
export function sessionCookie(req: Request, token: string | null, maxAgeSec: number): string {
  const secure = new URL(req.url).protocol === 'https:' ? '; Secure' : '';
  const value = token ? encodeURIComponent(token) : '';
  return `${SESSION_COOKIE}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${token ? maxAgeSec : 0}${secure}`;
}
