import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

const THEME_LIGHT = '#ECEEEA';

export default defineConfig({
  server: { port: 8000 },
  preview: { port: 8000 },
  build: {
    target: 'es2020',
    sourcemap: true,
  },
  plugins: [
    VitePWA({
      // Yeni sürüm arka planda iner, uygulama bir sonraki açılışta güncellenir.
      // Veriler her değişiklikte hemen kaydedildiği için sessiz güncelleme güvenli.
      registerType: 'autoUpdate',
      injectRegister: 'script',
      includeAssets: ['favicon.svg', 'apple-touch-icon-180x180.png'],
      manifest: {
        id: '/',
        name: 'Demir Defter',
        short_name: 'Demir Defter',
        description: 'Antrenman, beslenme ve kilo takibi',
        lang: 'tr',
        dir: 'ltr',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait',
        background_color: THEME_LIGHT,
        theme_color: THEME_LIGHT,
        categories: ['health', 'fitness', 'lifestyle'],
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
        shortcuts: [
          { name: 'Antrenman', short_name: 'Antrenman', url: '/?tab=log' },
          { name: 'Beslenme', short_name: 'Beslenme', url: '/?tab=food' },
          { name: 'Kilo', short_name: 'Kilo', url: '/?tab=body' },
        ],
      },
      workbox: {
        // Vietnamca font alt kümeleri gereksiz; yalnızca latin ve latin-ext (Türkçe) önbelleğe alınır.
        globPatterns: ['**/*.{js,css,html,svg,png,webmanifest}', '**/*latin*.woff2'],
        navigateFallback: '/index.html',
        cleanupOutdatedCaches: true,
      },
    }),
  ],
  test: {
    environment: 'node',
    include: ['tests/**/*.test.js'],
  },
});
