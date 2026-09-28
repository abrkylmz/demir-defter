/** tr-TR sayı biçimi: 1.234,5 */
export const fmt = (n: number, digits = 2): string =>
  Number(n).toLocaleString('tr-TR', { maximumFractionDigits: digits });

/** Buluttan gelen nesneler dondurulmuş olabilir; değiştirmeden önce kopyala. */
export const clone = <T>(v: T): T => (v == null ? v : JSON.parse(JSON.stringify(v)));

export const uid8 = (): string => Math.random().toString(36).slice(2, 10);

/** İsim karşılaştırmaları için büyük/küçük harf ve boşluktan bağımsız anahtar. */
export const nameKey = (name: string): string => name.trim().toLocaleLowerCase('tr-TR');
