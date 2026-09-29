// Fotoğrafı göndermeden önce telefonda küçültür: hem yükleme hızlanır hem model maliyeti düşer.

export interface PreparedImage {
  /** base64, "data:" öneki olmadan */
  base64: string;
  mediaType: 'image/jpeg';
  /** Önizleme için (URL.revokeObjectURL ile bırakılmalı) */
  previewUrl: string;
}

/** Uzun kenarı en fazla `maxSide` piksel olan JPEG'e çevirir; EXIF yönünü uygular. */
export async function prepareImage(file: Blob, maxSide = 1024, quality = 0.82): Promise<PreparedImage> {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas');
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();
  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(b => (b ? resolve(b) : reject(new Error('toBlob'))), 'image/jpeg', quality),
  );
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return { base64: btoa(bin), mediaType: 'image/jpeg', previewUrl: URL.createObjectURL(blob) };
}
