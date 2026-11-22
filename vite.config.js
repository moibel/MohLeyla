import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

import pkg from './package.json' with { type: 'json' };

// When accounts are switched on, open the connection to Supabase while the page is still loading (saves a round trip at sign-in / sync).
const supabasePreconnect = (url) => ({
  name: 'supabase-preconnect',
  transformIndexHtml: () => (/^https:\/\/[\w.-]+$/.test(url || '') ? [{ tag: 'link', attrs: { rel: 'preconnect', href: url, crossorigin: '' }, injectTo: 'head-prepend' }] : []),
});

export default defineConfig(({ mode }) => ({
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
  plugins: [
    react(),
    supabasePreconnect(loadEnv(mode, process.cwd(), 'VITE_').VITE_SUPABASE_URL),
    VitePWA({
      registerType: 'prompt', // the app shows an "update available" toast
      includeAssets: ['favicon.ico', 'icons/favicon.svg', 'icons/apple-touch-icon.png'],
      manifest: {
        id: '/',
        name: 'MohLeyla',
        short_name: 'MohLeyla',
        description: 'Learn Arabic (Standard, Saudi, Egyptian), English, Indonesian, French, Spanish and Chinese.',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'any',
        background_color: '#F4F8FF',
        theme_color: '#171E33',
        categories: ['education'],
        icons: [
          { src: '/icons/pwa-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/icons/pwa-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: '/icons/pwa-maskable-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
          { src: '/icons/pwa-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,webp,ico,woff2}'],
        globIgnores: ['icons/app-icon-1024.png', 'icons/og-image.png', 'icons/logo-mark-512.png', 'icons/logo-mark-on-dark-512.png'],
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/audio\//, /^\/\.netlify\//],
        cleanupOutdatedCaches: true,
        runtimeCaching: [
          {
            // Audio is NOT precached (too large); clips you have played are kept for offline replay.
            urlPattern: ({ url }) => url.pathname.startsWith('/audio/') && url.pathname.endsWith('.mp3'),
            handler: 'CacheFirst',
            options: {
              cacheName: 'mohleyla-audio-v1',
              expiration: { maxEntries: 1500, maxAgeSeconds: 60 * 60 * 24 * 180 },
              cacheableResponse: { statuses: [200] },
              rangeRequests: true,
            },
          },
        ],
      },
    }),
  ],
  build: {
    target: 'es2020',
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom', 'react-router-dom'],
          i18n: ['i18next', 'react-i18next'],
        },
      },
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['src/**/*.test.{js,jsx}'],
    setupFiles: ['src/test/setup.js'],
  },
}));
