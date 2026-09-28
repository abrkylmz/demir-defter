import { cloud } from './db.ts';

const isDeclined = (e: unknown) =>
  typeof e === 'object' && e !== null && (e as { code?: unknown }).code === 'declined';

/**
 * Dosyayı kullanıcıya indirir. claude.ai'da platformun indirme API'sini, başka her yerde
 * tarayıcının standart indirmesini kullanır. Kullanıcı vazgeçerse false döner.
 */
export async function saveFile(filename: string, content: string, mime: string): Promise<boolean> {
  if (cloud.downloads) {
    try {
      await cloud.downloads.save({ filename, data: content });
      return true;
    } catch (err) {
      if (isDeclined(err)) return false;
      throw err;
    }
  }
  const url = URL.createObjectURL(new Blob([content], { type: mime }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return true;
}

/** Kullanıcıya dosya seçtirir ve metin olarak okur; vazgeçerse null. */
export function pickTextFile(accept: string): Promise<string | null> {
  return new Promise(resolve => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.addEventListener('change', async () => {
      const file = input.files && input.files[0];
      resolve(file ? await file.text() : null);
    });
    input.addEventListener('cancel', () => resolve(null));
    input.click();
  });
}
