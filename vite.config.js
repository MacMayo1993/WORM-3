import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    // Service worker precache: makes deploys atomic for clients. Hashed
    // app assets (JS/CSS/HTML/fonts/Mobi) are versioned and swapped as a
    // set, so a deploy can never leave a client with a stale index.html
    // pointing at deleted chunks — the failure mode that produced blank
    // menus and reload loops on GitHub Pages. Repeat visits load from
    // the local cache. Heavy media (environments, models, images) is NOT
    // precached — it's cached lazily on first use instead.
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'WORM³ — World of Rubik\'s Manifolds',
        short_name: 'WORM³',
        description: '3D Rubik\'s Cube puzzle on real projective plane topology',
        start_url: '/WORM-3/',
        scope: '/WORM-3/',
        display: 'standalone',
        background_color: '#060a18',
        theme_color: '#060a18',
        icons: [{ src: 'vite.svg', sizes: 'any', type: 'image/svg+xml' }],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,woff2,woff,svg}', 'Mobi.webp'],
        globIgnores: ['environments/**', 'models/**', 'images/**', 'merge-mode/**'],
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        navigateFallback: '/WORM-3/index.html',
        runtimeCaching: [
          {
            // Big media: cache-first after first use, capped so the quota
            // never balloons past a few environment maps + models.
            urlPattern: /\/WORM-3\/(environments|models|images|merge-mode)\//,
            handler: 'CacheFirst',
            options: {
              cacheName: 'worm3-media',
              expiration: { maxEntries: 60, maxAgeSeconds: 30 * 24 * 3600, purgeOnQuotaError: true },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
  base: '/WORM-3/',
  optimizeDeps: {
    include: ['kociemba-wasm'],
  },
  build: {
    chunkSizeWarningLimit: 680,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return;
          if (id.includes('/node_modules/react/')) return 'vendor-react3d';
          if (id.includes('/node_modules/react-dom/')) return 'vendor-react3d';
          if (id.includes('/node_modules/@react-three/fiber/')) return 'vendor-react3d';
          if (id.includes('/node_modules/@react-three/drei/')) return 'vendor-react3d';
          if (id.includes('/node_modules/@react-three/postprocessing/')) return 'vendor-react3d';
          if (id.includes('/node_modules/postprocessing/')) return 'vendor-postprocessing';
          if (id.includes('/node_modules/three/examples/')) {
            const examplesPath = id.split('/node_modules/three/examples/')[1] || '';
            const bucket = examplesPath.split('/')[0] || 'misc';
            return `vendor-three-examples-${bucket.toLowerCase()}`;
          }
          if (id.includes('/node_modules/three/src/')) {
            const srcPath = id.split('/node_modules/three/src/')[1] || '';
            const bucket = srcPath.split('/')[0] || 'core';
            return `vendor-three-${bucket.toLowerCase()}`;
          }
          if (id.includes('/node_modules/three/')) return 'vendor-three';
          if (id.includes('/node_modules/gsap/')) return 'vendor-gsap';
          if (id.includes('/node_modules/use-sync-external-store/')) return 'vendor-react3d';
          if (id.includes('/node_modules/zustand/')) return 'vendor-react3d';
          if (id.includes('/node_modules/kociemba-wasm/')) return 'vendor-kociemba';
        },
      },
    },
  },
})
