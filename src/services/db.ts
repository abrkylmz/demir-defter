import { toast } from '../ui/toast.ts';

/**
 * Bulut bağlantısı. claude.ai artifact'ı olarak çalışırken `window.claude.use('db')` kullanılır;
 * başka her ortamda (yerel, Vercel) mode 'local' kalır ve veriler yalnızca localStorage'da tutulur.
 */
interface CloudState {
  mode: 'local' | 'cloud';
  db: CloudDb | null;
  userId: string | null;
  downloads: CloudDownloads | null;
}

export const cloud: CloudState = {
  mode: 'local',
  db: null,
  userId: null,
  /** CSV indirme API'si; yalnızca claude.ai'da var. */
  downloads: null,
};

export const isCloud = () => cloud.mode === 'cloud';

export const collection = (): CloudCollection => cloud.db!.collection('data/users/' + cloud.userId);

const chains: Record<string, Promise<void>> = {};

/** Hata nesnesinin platform kodu (ör. 'unavailable'). */
const errCode = (e: unknown): string | undefined =>
  typeof e === 'object' && e !== null && 'code' in e ? String((e as { code: unknown }).code) : undefined;

// ---------- yazılamayan ("kirli") belgeler ----------

const dirtyKey = () => `demirdefter.dirty:${cloud.userId || 'x'}`;

export function dirtyIds(): string[] {
  try {
    return JSON.parse(localStorage.getItem(dirtyKey()) || '[]');
  } catch {
    return [];
  }
}

function setDirty(ids: string[]): void {
  try {
    if (ids.length) localStorage.setItem(dirtyKey(), JSON.stringify(ids));
    else localStorage.removeItem(dirtyKey());
  } catch {
    // depolama kapalı: yalnızca bu oturumda kaybolur
  }
}

const markDirty = (id: string) => setDirty([...new Set([...dirtyIds(), id])]);
export const clearDirty = (id: string) => setDirty(dirtyIds().filter(x => x !== id));

/** Hemen yazar; hata fırlatır. */
export async function writeNow(id: string, data: object | null): Promise<void> {
  const ref = collection().doc(id);
  if (data) await ref.set(data);
  else await ref.delete();
}

/** Aynı belgeye yazımları sıraya koyar; `data` null ise belgeyi siler. Başarısız yazma kirli işaretlenir. */
export function writeDoc(id: string, data: object | null): Promise<void> {
  chains[id] = (chains[id] || Promise.resolve()).then(async () => {
    try {
      await writeNow(id, data);
      clearDirty(id);
    } catch (e) {
      if (errCode(e) === 'quota_exceeded') toast('Depolama dolu. Eski kayıtları silerek yer açabilirsin.');
      else if (errCode(e) === 'unauthorized') toast('Oturumun sona erdi, tekrar giriş yap.');
      markDirty(id);
    }
  });
  return chains[id];
}

/** Kuyruktaki tüm bulut yazmaları bittiğinde çözülür (çıkıştan önce). */
export const writesSettled = (): Promise<unknown> => Promise.all(Object.values(chains));
