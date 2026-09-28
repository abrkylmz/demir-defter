# Demir Defter

Spor salonu ve beslenme takip uygulaması. Mobil öncelikli, Türkçe arayüzlü, framework'süz bir web uygulaması.

- **Antrenman:** Set/tekrar girişi, bar üzerinde plaka görseli, tahmini 1TM (Epley), rekor bildirimi, hareket ve gün notları, şablonlar
- **Beslenme:** Besin veritabanı, öğün bazında kalori ve makro takibi, su takibi, Mifflin-St Jeor ile hedef hesaplama
- **Geçmiş ve ilerleme:** Haftalık kas grubu özeti, hareket bazında ilerleme grafiği
- **Kilo:** Tartı kayıtları ve 7 günlük hareketli ortalama
- **Uygulama (PWA):** Telefona kurulur, çevrimdışı çalışır; ana ekran kısayolları (Antrenman, Beslenme, Kilo)
- **Yedekleme:** JSON yedek alma / geri yükleme, Excel için CSV

## Teknoloji

|        |                                       |
| ------ | ------------------------------------- |
| Dil    | TypeScript (strict), CSS              |
| Build  | [Vite](https://vite.dev)              |
| Test   | [Vitest](https://vitest.dev)          |
| Kalite | ESLint, Prettier                      |
| Yayın  | [Vercel](https://vercel.com) (statik) |

Çalışma zamanında hiçbir npm bağımlılığı yoktur. Build çıktısı yalnızca HTML, CSS ve JS dosyalarından oluşur.

## Başlangıç

Node.js 20 veya üstü gerekir.

```bash
npm install
npm run dev        # http://localhost:8000
```

| Komut               | Ne yapar                                                    |
| ------------------- | ----------------------------------------------------------- |
| `npm run dev`       | Geliştirme sunucusu (anında yenileme)                       |
| `npm run build`     | `dist/` klasörüne production build                          |
| `npm run preview`   | Build çıktısını yerelde sunar                               |
| `npm test`          | Birim testleri                                              |
| `npm run lint`      | ESLint (typescript-eslint)                                  |
| `npm run typecheck` | TypeScript tip kontrolü                                     |
| `npm run format`    | Prettier ile biçimlendirme                                  |
| `npm run check`     | Lint + tip + format kontrolü + test + build (commit öncesi) |

## Proje yapısı

```
index.html              Uygulama kabuğu (başlık, sekme çubuğu, panel kapları)
public/                 Olduğu gibi kopyalanan dosyalar (favicon)
src/
  main.ts               Giriş noktası
  types.ts              Veri modeli tipleri (Store, Session, FoodItem…)
  env.d.ts              Standart olmayan tarayıcı/platform API tipleri
  events.ts             Tek click dinleyicisi; data-act / data-tab / data-date yönlendirmesi
  data/                 Sabit veriler: hareket kütüphanesi, besin tablosu
  lib/                  Saf yardımcılar: tarih, biçimlendirme, fitness hesapları
  state/                store (kalıcı veri) ve ui (geçici arayüz durumu)
  domain/               Veri sorguları: antrenman, beslenme, kilo
  services/             Kalıcılık (localStorage + bulut), senkron, CSV dışa aktarma
  views/                Sekme ekranları (HTML string üretir)
  sheets/               Alttan açılan paneller (set girişi, besin seçici, hedefler…)
  components/           Grafikler, bar görseli, hafta gezgini
  ui/                   Alt panel, bildirim, ikonlar
  styles/               Token'lar ve özelliğe göre bölünmüş CSS
tests/                  Vitest birim testleri
```

Veri akışı tek yönlüdür: bir olay `store`'u değiştirir → `persist*` ile kaydedilir → `render()` aktif ekranı yeniden çizer.

## Sürekli entegrasyon

Her push ve pull request'te GitHub Actions (`.github/workflows/ci.yml`) lint, tip kontrolü, biçim kontrolü, test ve build çalıştırır. Dependabot bağımlılık güncellemelerini aylık PR olarak açar.

## Veri ve depolama

Veriler tarayıcının `localStorage`'ında `demirdefter.v1` anahtarıyla tutulur. Bu yüzden:

- Veriler cihaza ve tarayıcıya özeldir. Telefonla bilgisayar arasında senkron **yoktur**.
- Tarayıcı verisini silmek kayıtları da siler. Ana ekrandaki **Yedekleme ve veriler** ile JSON yedek alınıp başka cihazda geri yüklenebilir; son yedek 14 günden eskiyse uyarı gösterilir.
- Yedekleme paneli açıldığında tarayıcıdan verileri kalıcı saklaması istenir (`navigator.storage.persist`).

Yedek biçimi: `{app: "demir-defter", version: 1, exportedAt, data: {sessions, custom, templates, body, food, foodCustom, goals}}`. Geri yüklemede dosya güvenilmez kabul edilir ve `src/services/backup.ts` içinde alan alan doğrulanır.

## PWA

`vite-plugin-pwa` (Workbox) build sırasında `sw.js` ve `manifest.webmanifest` üretir. Tüm uygulama dosyaları ve fontlar önbelleğe alınır; ilk ziyaretten sonra internet olmadan çalışır. Yeni sürüm arka planda iner ve bir sonraki açılışta devreye girer. Fontlar `@fontsource` ile uygulamanın içinden sunulur, dış sunucuya istek gitmez. İkonlar `public/` altındadır.

Uygulama claude.ai'da artifact olarak çalıştırıldığında `window.claude` API'si üzerinden hesaba bağlı bulut depolamayı otomatik olarak kullanır (`src/services/sync.ts`). Bu API başka hiçbir yerde yoktur.

Cihazlar arası senkron istenirse yalnızca `src/services/db.ts` ve `src/services/sync.ts` bir bulut servisiyle (Supabase, Firebase vb.) değiştirilir. Geri kalan kod `store` ve `persist*` fonksiyonlarını kullandığı için etkilenmez.

## Yayına alma (GitHub + Vercel)

1. GitHub'da boş bir repo oluştur ve kodu gönder:
   ```bash
   git init
   git add .
   git commit -m "İlk sürüm"
   git branch -M main
   git remote add origin https://github.com/<kullanici>/demir-defter.git
   git push -u origin main
   ```
2. [vercel.com/new](https://vercel.com/new) adresinden repoyu içe aktar. Framework Vite olarak otomatik algılanır; ayar değiştirmeye gerek yoktur.
3. Bundan sonra `main`'e yapılan her push otomatik olarak yayına çıkar. Diğer dallar için önizleme adresi oluşur.

`vercel.json` güvenlik başlıklarını (Content-Security-Policy vb.) ve `assets/` altındaki hash'li dosyalar için uzun süreli önbelleği ayarlar. Yeni bir dış kaynak (font, API, script) eklenirse CSP'ye de eklenmelidir.
