import type { MealKey } from '../types.ts';

/** [ad, kategori, kcal, protein, karbonhidrat, yağ (hepsi 100 g için), porsiyon adı, porsiyon gramı] */
type FoodRow = [string, string, number, number, number, number, string, number];

export const FOODS: FoodRow[] = [
  ['Tavuk göğsü (pişmiş)', 'Et, tavuk, balık', 165, 31, 0, 3.6, 'porsiyon', 150],
  ['Tavuk but, derisiz (pişmiş)', 'Et, tavuk, balık', 209, 26, 0, 10.9, 'porsiyon', 150],
  ['Hindi göğsü (pişmiş)', 'Et, tavuk, balık', 147, 30, 0, 2, 'porsiyon', 150],
  ['Yağsız dana eti (pişmiş)', 'Et, tavuk, balık', 200, 30, 0, 8, 'porsiyon', 150],
  ['Dana kıyma (pişmiş)', 'Et, tavuk, balık', 250, 26, 0, 17, 'porsiyon', 100],
  ['Köfte (ızgara)', 'Et, tavuk, balık', 240, 20, 6, 15, 'adet', 25],
  ['Somon (pişmiş)', 'Et, tavuk, balık', 206, 22, 0, 12, 'porsiyon', 150],
  ['Levrek / çipura (ızgara)', 'Et, tavuk, balık', 125, 24, 0, 3, 'porsiyon', 200],
  ['Ton balığı (suyla konserve)', 'Et, tavuk, balık', 116, 26, 0, 0.8, 'kutu', 150],
  ['Yumurta', 'Süt ürünleri, yumurta', 143, 12.6, 0.7, 9.5, 'adet', 50],
  ['Yumurta akı', 'Süt ürünleri, yumurta', 52, 10.9, 0.7, 0.2, 'adet', 33],
  ['Beyaz peynir', 'Süt ürünleri, yumurta', 260, 17, 1.5, 21, 'dilim', 30],
  ['Lor peyniri', 'Süt ürünleri, yumurta', 98, 11, 3.4, 4.3, 'yemek kaşığı', 20],
  ['Kaşar peyniri', 'Süt ürünleri, yumurta', 360, 25, 1.5, 28, 'dilim', 20],
  ['Süzme yoğurt (az yağlı)', 'Süt ürünleri, yumurta', 75, 10, 4, 2, 'kase', 150],
  ['Yoğurt (tam yağlı)', 'Süt ürünleri, yumurta', 61, 3.5, 4.7, 3.3, 'kase', 200],
  ['Süt (yarım yağlı)', 'Süt ürünleri, yumurta', 50, 3.4, 4.8, 1.7, 'bardak', 200],
  ['Ayran', 'Süt ürünleri, yumurta', 36, 1.7, 2.8, 1.9, 'bardak', 200],
  ['Kefir', 'Süt ürünleri, yumurta', 55, 3.3, 4.5, 2.5, 'bardak', 200],
  ['Whey protein tozu', 'Takviye', 380, 78, 8, 5, 'ölçek', 30],
  ['Protein bar', 'Takviye', 350, 33, 35, 11, 'adet', 60],
  ['Kırmızı mercimek (haşlanmış)', 'Baklagil', 116, 9, 20, 0.4, 'kase', 180],
  ['Nohut (haşlanmış)', 'Baklagil', 164, 8.9, 27.4, 2.6, 'kase', 160],
  ['Kuru fasulye (haşlanmış)', 'Baklagil', 127, 8.7, 22.8, 0.5, 'kase', 180],
  ['Pirinç (haşlanmış)', 'Tahıl, ekmek', 130, 2.7, 28, 0.3, 'kase', 180],
  ['Pirinç pilavı (tereyağlı)', 'Tahıl, ekmek', 165, 3, 30, 3.5, 'kase', 180],
  ['Bulgur pilavı', 'Tahıl, ekmek', 120, 3.3, 21, 2.5, 'kase', 180],
  ['Makarna (haşlanmış)', 'Tahıl, ekmek', 158, 5.8, 31, 0.9, 'tabak', 200],
  ['Yulaf ezmesi', 'Tahıl, ekmek', 379, 13, 68, 6.5, 'yemek kaşığı', 10],
  ['Tam buğday ekmeği', 'Tahıl, ekmek', 250, 13, 41, 3.4, 'dilim', 30],
  ['Beyaz ekmek', 'Tahıl, ekmek', 265, 9, 49, 3.2, 'dilim', 30],
  ['Lavaş / tortilla', 'Tahıl, ekmek', 300, 8, 50, 7, 'adet', 60],
  ['Simit', 'Tahıl, ekmek', 300, 10, 55, 5, 'adet', 110],
  ['Pirinç patlağı', 'Tahıl, ekmek', 387, 8, 81, 2.8, 'adet', 9],
  ['Granola', 'Tahıl, ekmek', 470, 10, 64, 20, 'kase', 50],
  ['Patates (haşlanmış)', 'Sebze, meyve', 87, 1.9, 20, 0.1, 'orta boy', 170],
  ['Tatlı patates (fırın)', 'Sebze, meyve', 90, 2, 20.7, 0.2, 'orta boy', 150],
  ['Muz', 'Sebze, meyve', 89, 1.1, 22.8, 0.3, 'orta boy', 120],
  ['Elma', 'Sebze, meyve', 52, 0.3, 13.8, 0.2, 'orta boy', 180],
  ['Portakal', 'Sebze, meyve', 47, 0.9, 11.8, 0.1, 'orta boy', 150],
  ['Çilek', 'Sebze, meyve', 32, 0.7, 7.7, 0.3, 'kase', 150],
  ['Hurma (kuru)', 'Sebze, meyve', 282, 2.5, 75, 0.4, 'adet', 10],
  ['Karışık salata (soslu değil)', 'Sebze, meyve', 20, 1.3, 3.5, 0.2, 'kase', 150],
  ['Domates', 'Sebze, meyve', 18, 0.9, 3.9, 0.2, 'orta boy', 120],
  ['Salatalık', 'Sebze, meyve', 15, 0.7, 3.6, 0.1, 'orta boy', 150],
  ['Brokoli (haşlanmış)', 'Sebze, meyve', 35, 2.4, 7.2, 0.4, 'kase', 150],
  ['Zeytinyağı', 'Yağ, kuruyemiş', 884, 0, 0, 100, 'yemek kaşığı', 13],
  ['Tereyağı', 'Yağ, kuruyemiş', 717, 0.9, 0.1, 81, 'tatlı kaşığı', 5],
  ['Fıstık ezmesi', 'Yağ, kuruyemiş', 588, 25, 20, 50, 'yemek kaşığı', 16],
  ['Badem', 'Yağ, kuruyemiş', 579, 21, 22, 50, 'avuç', 28],
  ['Ceviz', 'Yağ, kuruyemiş', 654, 15, 14, 65, 'avuç', 28],
  ['Fındık', 'Yağ, kuruyemiş', 628, 15, 17, 61, 'avuç', 28],
  ['Avokado', 'Yağ, kuruyemiş', 160, 2, 8.5, 14.7, 'yarım', 75],
  ['Zeytin', 'Yağ, kuruyemiş', 145, 1, 3.8, 15, 'adet', 4],
  ['Bal', 'Diğer', 304, 0.3, 82, 0, 'tatlı kaşığı', 7],
  ['Mercimek çorbası', 'Hazır yemek', 70, 3.5, 10, 2, 'kase', 250],
  ['Menemen', 'Hazır yemek', 110, 5.5, 4, 8, 'porsiyon', 200],
  ['Tavuk döner (dürüm)', 'Hazır yemek', 220, 14, 22, 8, 'adet', 250],
  ['Lahmacun', 'Hazır yemek', 230, 10, 30, 8, 'adet', 150],
];

export const FOOD_CATS = [
  'Et, tavuk, balık',
  'Süt ürünleri, yumurta',
  'Baklagil',
  'Tahıl, ekmek',
  'Sebze, meyve',
  'Yağ, kuruyemiş',
  'Hazır yemek',
  'Takviye',
  'Diğer',
];

/** Kullanıcının kendi eklediği besinlerin kategorisi. */
export const MY_FOODS_CAT = 'Benim';

export const MEALS: [MealKey, string][] = [
  ['kahvalti', 'Kahvaltı'],
  ['ogle', 'Öğle'],
  ['aksam', 'Akşam'],
  ['ara', 'Ara öğün'],
];

export const mealName = (k: MealKey): string => (MEALS.find(m => m[0] === k) || MEALS[3])[1];

/** Saate göre en olası öğün. */
export const defaultMeal = (hour = new Date().getHours()): MealKey =>
  hour < 11 ? 'kahvalti' : hour < 16 ? 'ogle' : hour < 22 ? 'aksam' : 'ara';
