import { cloud } from './db.js';

/**
 * Dosyayı kullanıcıya indirir. claude.ai'da platformun indirme API'sini, başka her yerde
 * tarayıcının standart indirmesini kullanır. Kullanıcı vazgeçerse false döner.
 */
export async function saveFile(filename, content, mime) {
  if (cloud.downloads) {
    try {
      await cloud.downloads.save({ filename, data: content });
      return true;
    } catch (err) {
      if (err && err.code === 'declined') return false;
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
export function pickTextFile(accept) {
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
