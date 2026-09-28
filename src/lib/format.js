/** tr-TR sayı biçimi: 1.234,5 */
export const fmt = (n, digits = 2) => Number(n).toLocaleString('tr-TR', { maximumFractionDigits: digits });

/** Buluttan gelen nesneler dondurulmuş olabilir; değiştirmeden önce kopyala. */
export const clone = v => (v == null ? v : JSON.parse(JSON.stringify(v)));

export const uid8 = () => Math.random().toString(36).slice(2, 10);

/** İsim karşılaştırmaları için büyük/küçük harf ve boşluktan bağımsız anahtar. */
export const nameKey = name => name.trim().toLocaleLowerCase('tr-TR');
