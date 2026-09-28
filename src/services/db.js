import { toast } from '../ui/toast.js';

/**
 * Bulut bağlantısı. claude.ai artifact'ı olarak çalışırken `window.claude.use('db')` kullanılır;
 * başka her ortamda (yerel, Vercel) mode 'local' kalır ve veriler yalnızca localStorage'da tutulur.
 */
export const cloud = {
  mode: 'local',
  db: null,
  userId: null,
  /** CSV indirme API'si; yalnızca claude.ai'da var. */
  downloads: null,
};

export const isCloud = () => cloud.mode === 'cloud';

export const collection = () => cloud.db.collection('data/users/' + cloud.userId);

const chains = {};

async function writeOnce(id, data) {
  const ref = collection().doc(id);
  if (data) await ref.set(data);
  else await ref.delete();
}

/** Aynı belgeye yazımları sıraya koyar; `data` null ise belgeyi siler. */
export function writeDoc(id, data) {
  chains[id] = (chains[id] || Promise.resolve()).then(async () => {
    try {
      await writeOnce(id, data);
    } catch (e) {
      if (e && e.code === 'unavailable') {
        await new Promise(r => setTimeout(r, 800 + Math.random() * 800));
        try {
          await writeOnce(id, data);
        } catch {
          // ikinci deneme de başarısız: bir sonraki değişiklikte tekrar yazılır
        }
      } else if (e && e.code === 'quota_exceeded') {
        toast('Depolama dolu. Eski kayıtları silerek yer açabilirsin.');
      }
    }
  });
  return chains[id];
}
