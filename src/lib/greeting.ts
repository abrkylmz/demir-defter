/** Saate göre selamlama: 05–12 Günaydın, 12–18 İyi günler, 18–24 İyi akşamlar, 00–05 İyi geceler. */
export function greetingWord(hour: number): string {
  if (hour < 5) return 'İyi geceler';
  if (hour < 12) return 'Günaydın';
  if (hour < 18) return 'İyi günler';
  return 'İyi akşamlar';
}

/** "Günaydın, Ahmet" — ad yoksa yalnızca "Günaydın". */
export function greeting(hour: number, name?: string): string {
  const n = name?.trim();
  return n ? `${greetingWord(hour)}, ${n}` : greetingWord(hour);
}

/** Addan baş harf (avatar için). Türkçe büyük harf kuralıyla: "ilker" → "İ". */
export const initial = (name?: string): string => (name?.trim()[0] || '').toLocaleUpperCase('tr-TR');
