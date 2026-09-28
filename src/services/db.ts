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

async function writeOnce(id: string, data: object | null): Promise<void> {
  const ref = collection().doc(id);
  if (data) await ref.set(data);
  else await ref.delete();
}

/** Aynı belgeye yazımları sıraya koyar; `data` null ise belgeyi siler. */
export function writeDoc(id: string, data: object | null): Promise<void> {
  chains[id] = (chains[id] || Promise.resolve()).then(async () => {
    try {
      await writeOnce(id, data);
    } catch (e) {
      if (errCode(e) === 'unavailable') {
        await new Promise(r => setTimeout(r, 800 + Math.random() * 800));
        try {
          await writeOnce(id, data);
        } catch {
          // ikinci deneme de başarısız: bir sonraki değişiklikte tekrar yazılır
        }
      } else if (errCode(e) === 'quota_exceeded') {
        toast('Depolama dolu. Eski kayıtları silerek yer açabilirsin.');
      }
    }
  });
  return chains[id];
}

/** Kuyruktaki tüm bulut yazmaları bittiğinde çözülür (çıkıştan önce). */
export const writesSettled = (): Promise<unknown> => Promise.all(Object.values(chains));
