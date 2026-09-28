# Demir Defter

Spor salonu ve beslenme takip uygulaması. Mobil öncelikli web uygulaması. Arayüz dili Türkçe.

## Yapı

- Vite + TypeScript (strict, framework yok). Dev araçları: Vite, Vitest, ESLint (typescript-eslint), Prettier. CI: GitHub Actions (`npm run check` adımları).
- Veri modeli tipleri `src/types.ts`'te; claude.ai bulut API'si ve PWA olayları `src/env.d.ts`'te. `any` kullanma; dışarıdan gelen veri `unknown` olarak alınıp daraltılmalı (bkz. `services/backup.ts`).
- DOM: `lib/dom.ts` → `# Demir Defter

Spor salonu ve beslenme takip uygulaması. Mobil öncelikli web uygulaması. Arayüz dili Türkçe.

## Yapı

/`q` (öğe yoksa hata fırlatır, var olduğu bilinen öğeler için), `qa`, `closest`, `data` (dataset okur). İsteğe bağlı öğeler için `querySelector` kullan.

- Yayın: GitHub → Vercel (statik, `dist/`). Ayarlar ve güvenlik başlıkları `vercel.json`'da.
- Fontlar `@fontsource` ile paketleniyor (`styles/fonts.css`; Barlow, Barlow Condensed). Hiç dış kaynak yok; CSP `'self'` ile sınırlı. Yeni dış kaynak eklenirse `vercel.json`'daki CSP'ye de ekle.
- PWA: `vite-plugin-pwa` (vite.config.ts). Manifest, ikonlar (`public/`), çevrimdışı önbellek ve `?tab=` kısayolları (`main.ts`). Kurulum düğmesi `services/install.ts`.
- Yedekleme: `services/backup.ts` (JSON al/doğrula/geri yükle), `sheets/data.ts` paneli, `services/files.ts` (indirme). Yedek dosyası güvenilmezdir; yeni alan eklersen `parseBackup` temizleyicisine de ekle ve `tests/backup.test.ts`'i güncelle.
- Komutlar: `npm run dev` (localhost:8000), `npm run build`, `npm test`, `npm run typecheck`, `npm run check` (lint + tip + format + test + build).
- Git Bash'te `vitest` "failed to find the runner" hatası verebilir (MSYS yolu). Testleri PowerShell'den çalıştır.

## Klasörler (`src/`)

- `main.ts` giriş noktası; `events.ts` tek `document` click dinleyicisi (`data-act` → `ACTIONS` tablosu, `data-tab`, `data-date`)
- `data/` hareket kütüphanesi `LIB`/`GROUPS`, besin tablosu `FOODS` (100 g başına kcal/protein/karb/yağ + porsiyon), `MEALS`
- `lib/` saf yardımcılar: `date.ts`, `format.ts` (`fmt` tr-TR, `clone`, `nameKey`), `dom.ts` (`esc`, `parseDecimal`), `fitness.ts` (`e1rm` Epley, `platesFor`, `calcTargets` Mifflin-St Jeor)
- `state/` `store` (kalıcı veri, `loadLocal/saveLocal`) ve `ui` (geçici durum, `ui.sheetOpen` dahil)
- `domain/` sorgular: `workout.ts` (`sortedDates`, `lastTime`, `exerciseHistory`, `bestE1`, `groupSets`…), `nutrition.ts`, `body.ts`
- `services/` `db.ts` (bulut bağlantısı, `writeDoc`), `persist.ts` (`persistSession/Settings/Body/Food/Nut`), `sync.ts` (`initCloud`), `export.ts` (CSV)
- `views/` `render()` → `renderHome`, `renderLog`, `renderFood`, `renderHistory`, `renderProgress`, `renderBody`
- `sheets/` alt paneller: set girişi, hareket seçici/menü, not, şablonlar, besin seçici/miktar/özel besin, hedefler, tartı
- `components/` grafikler, bar görseli, hafta gezgini; `ui/` `openSheet/closeSheet`, `toast`, ikonlar
- `styles/` `tokens.css` + özelliğe göre CSS dosyaları; sıra `styles/index.css`'te (kaskad sırası önemli)

## Veri modeli (`store`)

- `sessions[YYYY-MM-DD] = {date, note?, exercises:[{id, name, group, bar, note?, sets:[{kg, reps}]}]}` (hareket notu sonraki antrenmanda "Son sefer" kutusunda görünür)
- `custom = [{name, group, bar}]`, `templates = [{id, name, exercises:[{name, group, bar}]}]`
- `body[YYYY-MM-DD] = kg`
- `food[YYYY-MM-DD] = {items:[{id, name, meal, g, per:{k,p,c,f}, pl, pg}], water}` (`meal`: kahvalti | ogle | aksam | ara)
- `foodCustom = [{name, k, p, c, f, pl, pg}]`, `goals = {kcal, p, c, f, water, profile}`
- localStorage anahtarı `demirdefter.v1`. Şemayı değiştirirken mevcut kullanıcı verisini bozma.

## Depolama (önemli)

- Varsayılan: `localStorage` (Vercel dahil her yerde). Cihazlar arası senkron yok.
- claude.ai artifact'ı olarak çalışırken `window.claude.use('db' | 'user' | 'downloads')` ile bulut kullanılır. Belgeler: `s-<tarih>`, `f-<tarih>`, `body`, `settings` (custom + templates + profile), `nutrition`.
- `store.profile = {name?, weeklyGoal?}`: ana ekran selamlaması (`lib/greeting.ts`) ve haftalık hedef (`domain/weekly.ts`).
- Akıllı öneri `domain/suggest.ts` (çift progresyon), rekorlar `domain/records.ts`. Kurallarını değiştirirsen `tests/features.test.ts`'i güncelle.
- Buluttan gelen veriler dondurulmuş nesnelerdir; her zaman `clone()` ile kopyala.
- Alt panel açıkken o günün bulut güncellemeleri bekletilir (`ui.sheetOpen` kontrolü); bu korumayı kaldırma.
- Senkron için başka servis (Supabase/Firebase) istenirse yalnızca `services/db.ts` + `services/sync.ts` değişir.

## Tasarım kuralları

- Renkler `styles/tokens.css`'te ("Sıcak & Enerjik": krem zemin, mercan marka); açık ve koyu tema var (`prefers-color-scheme` + `data-theme`). Yeni renk eklerken iki temaya da ekle ve metin/zemin kontrastının ≥4.5:1 olduğunu ölç.
- `--brand` (#FF5A36) yalnızca büyük dolgu/degrade/halka içindir; üzerindeki küçük metin okunmaz. Düğme ve metin rengi `--accent`. Durum rozetleri üzerindeki metin `--on-status`.
- Gölgeler `--shadow-1` / `--shadow-2`; kartların gölge, hover ve geçişleri `styles/polish.css`'te (en son yüklenir).
- Plaka renkleri anlam taşıyor: kırmızı 25, mavi 20, sarı 15, yeşil 10 kg. Ana ekran kutuları da bu paleti kullanıyor, beslenme turuncu (`--orange`).
- Rakamlar `--display` (Barlow Condensed) fontuyla, `tabular-nums`.
- Dokunma hedefleri en az 44px. Telefon güvenli alan (safe-area) padding'leri korunmalı.
- `prefers-reduced-motion` açıkken animasyonlar kapanıyor.
- Kullanıcıya görünen tüm metinler Türkçe. HTML'e giren her kullanıcı metni `esc()` ile kaçırılmalı.
- Prefix'li CSS özelliğini standart olandan ÖNCE yaz (ör. `-webkit-backdrop-filter` sonra `backdrop-filter`); aksi halde Vite'ın CSS küçültücüsü standart olanı siler.
- Alt panelde olay dinleyicilerini panelin içindeki öğelere bağla; `#sheet` öğesi tekrar kullanılıyor, ona bağlanan dinleyici birikir.

## Değişiklik sonrası kontrol

- `npm run check` geçmeli.
- `npm run dev` ile konsolda hata olmamalı; mobil genişlikte (390px) ve masaüstünde, açık ve koyu temada bak.
- Antrenman ekle → set gir → Geçmiş/İlerleme; şablon kaydet/uygula; Beslenme → gün aç → besin ekle; Kilo → tartı ekle akışlarını dene.
