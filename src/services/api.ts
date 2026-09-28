// Kendi API'miz (/api, Vercel Functions + Neon) için istemci: hesap işlemleri ve CloudDb adaptörü.
// API yoksa (yerel geliştirme, veritabanı bağlanmamış) uygulama hesapsız yerel modda çalışır.

export interface AccountUser {
  id: string;
  email: string;
  name: string;
}

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
  ) {
    super(code);
  }
}

/** Değiştirici isteklerde sunucunun beklediği başlık (CSRF koruması). */
const CLIENT_HEADER = { 'x-demir-defter': '1' };

async function api<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, {
      method: init.method || 'GET',
      credentials: 'same-origin',
      headers: {
        ...CLIENT_HEADER,
        ...(init.body !== undefined ? { 'content-type': 'application/json' } : {}),
      },
      body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
    });
  } catch {
    throw new ApiError(0, 'unavailable');
  }
  // API olmayan ortamda (ör. vite dev) sunucu index.html döner: API yok say
  if (!(res.headers.get('content-type') || '').includes('application/json'))
    throw new ApiError(404, 'no_api');
  const data = (await res.json().catch(() => ({}))) as { error?: string };
  if (!res.ok)
    throw new ApiError(res.status, data.error || (res.status === 401 ? 'unauthorized' : 'server_error'));
  return data as T;
}

// ---------- hesap ----------

export interface AuthStatus {
  /** Sunucuda hesap sistemi (veritabanı) var mı */
  available: boolean;
  user: AccountUser | null;
  /** Şifre sıfırlama e-postası gönderilebiliyor mu */
  reset: boolean;
}

/** Açılışta: hesap sistemi açık mı ve oturum var mı? Ağ yoksa ApiError(0) fırlatır. */
export async function authStatus(): Promise<AuthStatus> {
  try {
    const r = await api<{ user: AccountUser | null; reset: boolean }>('/api/auth');
    return { available: true, user: r.user, reset: r.reset };
  } catch (e) {
    // 404: API yok (ör. vite dev), 503: veritabanı bağlanmamış
    if (e instanceof ApiError && (e.status === 404 || e.status === 503 || e.status === 405))
      return { available: false, user: null, reset: false };
    throw e;
  }
}

const post = <T>(action: string, body: object) =>
  api<T>(`/api/auth?action=${action}`, { method: 'POST', body });

export const signUp = (name: string, email: string, password: string) =>
  post<{ user: AccountUser }>('signup', { name, email, password }).then(r => r.user);
export const signIn = (email: string, password: string) =>
  post<{ user: AccountUser }>('login', { email, password }).then(r => r.user);
export const signOut = () => post('logout', {});
export const requestPasswordReset = (email: string) => post('reset-request', { email });
export const deleteAccount = (password: string) => post('delete', { password });
export const resetPassword = (token: string, password: string) =>
  post<{ user: AccountUser }>('reset', { token, password }).then(r => r.user);

/** Sunucu hata kodlarının Türkçesi. */
export function authErrorText(e: unknown): string {
  const code = e instanceof ApiError ? e.code : '';
  switch (code) {
    case 'invalid_credentials':
      return 'E-posta ya da şifre hatalı.';
    case 'email_taken':
      return 'Bu e-postayla zaten bir hesap var. Giriş yapmayı dene.';
    case 'weak_password':
      return 'Şifre en az 8 karakter olmalı.';
    case 'invalid_email':
      return 'Geçerli bir e-posta gir.';
    case 'name_required':
      return 'Adını yaz, seni adınla karşılayalım.';
    case 'too_many_attempts':
      return 'Çok fazla deneme oldu. 15 dakika sonra tekrar dene.';
    case 'invalid_token':
      return 'Bu bağlantının süresi dolmuş ya da kullanılmış. Yeni bir bağlantı iste.';
    case 'unavailable':
      return 'İnternet bağlantısı yok gibi görünüyor.';
    default:
      return 'Bir sorun oluştu, tekrar dene.';
  }
}

// ---------- CloudDb adaptörü ----------

interface DocsResponse {
  docs: { id: string; data: unknown }[];
  ids: string[];
  now: string;
}

/** Değişiklikleri çekme aralığı (uygulama açık ve görünürken). */
const POLL_MS = 60_000;
/** Sunucu saatindeki küçük sapmalar ve eşzamanlı yazmalar için örtüşme payı. */
const SINCE_OVERLAP_MS = 5_000;

/**
 * /api/docs'u sync.ts'in beklediği CloudDb arayüzüne uyarlar. Canlı yayın yerine: uygulama öne geldiğinde,
 * internet geri geldiğinde ve açıkken dakikada bir değişiklikler çekilir.
 * @param beforePoll her çekmeden önce çalışır (ör. çevrimdışı yazılamayan belgeleri göndermek için)
 */
export function apiDb(beforePoll: () => Promise<unknown>): CloudDb & { close(): void } {
  let since: string | null = null;
  let known = new Set<string>();
  const stops: (() => void)[] = [];
  const toDoc = (d: { id: string; data: unknown }): CloudDoc => ({ id: d.id, data: () => d.data });

  const fetchDocs = async (sinceParam: string | null) => {
    const q = sinceParam ? `?since=${encodeURIComponent(sinceParam)}` : '';
    const r = await api<DocsResponse>(`/api/docs${q}`);
    since = new Date(Date.parse(r.now) - SINCE_OVERLAP_MS).toISOString();
    return r;
  };

  const collection: CloudCollection = {
    doc: id => ({
      async set(data) {
        await api(`/api/docs?id=${encodeURIComponent(id)}`, { method: 'PUT', body: { data } });
      },
      async delete() {
        await api(`/api/docs?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
      },
    }),

    async get() {
      const r = await fetchDocs(null);
      known = new Set(r.ids);
      const docs = r.docs.map(toDoc);
      return { docs, docChanges: () => docs.map(doc => ({ type: 'added' as const, doc })) };
    },

    onSnapshot(onNext, onError) {
      let busy = false;
      const poll = async () => {
        if (busy || document.visibilityState !== 'visible') return;
        busy = true;
        try {
          await beforePoll();
          const r = await fetchDocs(since);
          const changes: CloudDocChange[] = r.docs.map(d => ({
            type: known.has(d.id) ? 'modified' : 'added',
            doc: toDoc(d),
          }));
          const now = new Set(r.ids);
          for (const id of known)
            if (!now.has(id)) changes.push({ type: 'removed', doc: toDoc({ id, data: null }) });
          known = now;
          if (changes.length) onNext({ docs: changes.map(c => c.doc), docChanges: () => changes });
        } catch (e) {
          onError(e);
        } finally {
          busy = false;
        }
      };
      const timer = setInterval(poll, POLL_MS);
      const onVisible = () => void poll();
      document.addEventListener('visibilitychange', onVisible);
      window.addEventListener('online', onVisible);
      stops.push(() => {
        clearInterval(timer);
        document.removeEventListener('visibilitychange', onVisible);
        window.removeEventListener('online', onVisible);
      });
      return () => stops.forEach(s => s());
    },
  };

  return { collection: () => collection, close: () => stops.splice(0).forEach(s => s()) };
}
