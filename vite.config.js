import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { normalizeBase } from './scripts/normalizeBase.mjs'

// Deploy base. GitHub Pages serves this repo from /WORM-3/, but the PWA manifest,
// the navigation fallback and the media runtime-cache rule all used to repeat that
// literal, so a preview build or a CDN prefix could not be smoke-tested without
// editing source. VITE_BASE overrides it for exactly that case.
//
// Normalised before use: Vite would happily accept `VITE_BASE=/preview` and serve
// from `/preview/`, but the concatenations below would then build
// `/previewindex.html` and `/previewenvironments/…`. See scripts/normalizeBase.mjs.
const BASE = normalizeBase(process.env.VITE_BASE || '/WORM-3/')
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

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
      // 'prompt', not 'autoUpdate': autoUpdate calls window.location.reload()
      // the moment a new deploy's worker activates, yanking the page out from
      // under whoever is mid-session (this repo deploys many times a day, so
      // that reload fired constantly — the "double-boot" and vanishing-Mobi
      // reports). 'prompt' downloads the new build quietly and lets us show a
      // small "update ready" toast instead (see registerSW in main.jsx), so the
      // page only ever reloads when the user asks it to.
      registerType: 'prompt',
      manifest: {
        name: 'WORM³ — World of Rubik\'s Manifolds',
        short_name: 'WORM³',
        description: '3D Rubik\'s Cube puzzle on real projective plane topology',
        start_url: BASE,
        scope: BASE,
        display: 'standalone',
        background_color: '#060a18',
        theme_color: '#060a18',
        icons: [{ src: 'vite.svg', sizes: 'any', type: 'image/svg+xml' }],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,woff2,woff,svg}', 'Mobi.webp'],
        globIgnores: ['environments/**', 'models/**', 'images/**', 'merge-mode/**'],
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        navigateFallback: `${BASE}index.html`,
        runtimeCaching: [
          {
            // Big media: cache-first after first use, capped so the quota
            // never balloons past a few environment maps + models.
            urlPattern: new RegExp(`${escapeRe(BASE)}(environments|models|images|merge-mode)/`),
            handler: 'CacheFirst',
            options: {
              cacheName: 'worm3-media',
              // Env maps run 20–26MB each, so 60 entries could pin ~1GB+ of
              // Cache Storage. Cap at 8 — enough for a session's worth of
              // backgrounds/models without letting the quota balloon.
              expiration: { maxEntries: 8, maxAgeSeconds: 30 * 24 * 3600, purgeOnQuotaError: true },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
  base: BASE,
  optimizeDeps: {
    include: ['kociemba-wasm'],
  },
  build: {
    chunkSizeWarningLimit: 680,
    // Emitted so scripts/check-bundle-size.mjs can walk the entry's static import
    // graph instead of only looking at each file in isolation — a route can
    // regress badly while every individual chunk stays under its ceiling.
    manifest: true,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return;
          // React and the state layer ride in their own chunk rather than with the
          // r3f/drei stack. Together they were one 740 KB asset — over the size
          // guard in scripts/check-bundle-size.mjs, and the two halves have nothing
          // to do with each other: React changes on its own release cadence, while
          // drei is the half that actually grows as this app uses more of it.
          if (id.includes('/node_modules/react/')) return 'vendor-react';
          if (id.includes('/node_modules/react-dom/')) return 'vendor-react';
          if (id.includes('/node_modules/scheduler/')) return 'vendor-react';
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
          if (id.includes('/node_modules/use-sync-external-store/')) return 'vendor-react';
          if (id.includes('/node_modules/zustand/')) return 'vendor-react';
          if (id.includes('/node_modules/kociemba-wasm/')) return 'vendor-kociemba';
        },
      },
    },
  },
})
