# Demir Defter

Spor salonu ve beslenme takip uygulaması. Mobil öncelikli web uygulaması. Arayüz dili Türkçe.

## Yapı

- Vite + vanilla JS (ES modülleri). Framework yok, çalışma zamanı bağımlılığı yok. Dev araçları: Vite, Vitest, ESLint, Prettier.
- Yayın: GitHub → Vercel (statik, `dist/`). Ayarlar ve güvenlik başlıkları `vercel.json`'da.
- Fontlar Google Fonts'tan geliyor (Barlow, Barlow Condensed). Başka dış kaynak yok. Yeni dış kaynak eklenirse `vercel.json`'daki CSP'ye de ekle.
- Komutlar: `npm run dev` (localhost:8000), `npm run build`, `npm test`, `npm run check` (lint + format + test + build).
- Git Bash'te `vitest` "failed to find the runner" hatası verebilir (MSYS yolu). Testleri PowerShell'den çalıştır.

## Klasörler (`src/`)

- `main.js` giriş noktası; `events.js` tek `document` click dinleyicisi (`data-act` → `ACTIONS` tablosu, `data-tab`, `data-date`)
- `data/` hareket kütüphanesi `LIB`/`GROUPS`, besin tablosu `FOODS` (100 g başına kcal/protein/karb/yağ + porsiyon), `MEALS`
- `lib/` saf yardımcılar: `date.js`, `format.js` (`fmt` tr-TR, `clone`, `nameKey`), `dom.js` (`esc`, `parseDecimal`), `fitness.js` (`e1rm` Epley, `platesFor`, `calcTargets` Mifflin-St Jeor)
- `state/` `store` (kalıcı veri, `loadLocal/saveLocal`) ve `ui` (geçici durum, `ui.sheetOpen` dahil)
- `domain/` sorgular: `workout.js` (`sortedDates`, `lastTime`, `exerciseHistory`, `bestE1`, `groupSets`…), `nutrition.js`, `body.js`
- `services/` `db.js` (bulut bağlantısı, `writeDoc`), `persist.js` (`persistSession/Settings/Body/Food/Nut`), `sync.js` (`initCloud`), `export.js` (CSV)
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
- claude.ai artifact'ı olarak çalışırken `window.claude.use('db' | 'user' | 'downloads')` ile bulut kullanılır. Belgeler: `s-<tarih>`, `f-<tarih>`, `body`, `settings` (custom + templates), `nutrition`. CSV butonu yalnızca orada görünür.
- Buluttan gelen veriler dondurulmuş nesnelerdir; her zaman `clone()` ile kopyala.
- Alt panel açıkken o günün bulut güncellemeleri bekletilir (`ui.sheetOpen` kontrolü); bu korumayı kaldırma.
- Senkron için başka servis (Supabase/Firebase) istenirse yalnızca `services/db.js` + `services/sync.js` değişir.

## Tasarım kuralları

- Renkler `styles/tokens.css`'te; açık ve koyu tema var (`prefers-color-scheme` + `data-theme`). Yeni renk eklerken iki temaya da ekle.
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
