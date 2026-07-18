// preloadAssets.js — warm every deferred resource during the opening animation.
//
// The welcome cinematic gives us ~14 idle seconds on a cold load. Anything not
// warmed here pops in late on slow connections: lazy UI chunks render nothing
// (null Suspense fallbacks), webfonts flash fallback faces, Mobi's portrait
// appears blank, and environment maps leave a black background. Fetch failures
// are ignored — this is purely a cache-warming pass; every asset still loads
// on demand as before if the preload missed it.

import { BACKGROUNDS, getBackgroundUrl } from './backgrounds.js';

let started = false;

// Warm an HTTP cache entry without keeping the response.
const warm = (url) => fetch(url, { credentials: 'same-origin' }).catch(() => { });

export function preloadAppAssets({ backgroundTheme } = {}) {
  if (started) return;
  started = true;

  // 1. Lazy route/UI chunks — everything React.lazy() pulls after boot.
  //    (Vite turns each import() into a cached chunk fetch; failures here
  //    surface later through the normal vite:preloadError recovery path.)
  const chunks = [
    import('../components/UILayer.jsx'),
    import('../3d/GameScene.jsx'),
    import('../components/screens/ParityStoreScreen.jsx'),
    import('../components/screens/DemoEndScreen.jsx'),
    import('../components/screens/DemoForecastPicker.jsx'),
  ];
  chunks.forEach((p) => p.catch(() => { }));

  // 2. Mobi's portrait — used by every dialogue (mode intros + demo steps).
  const mobi = new Image();
  mobi.src = `${import.meta.env.BASE_URL}Mobi.webp`;

  // 3. Environment maps: the player's current background plus the demo's
  //    desert — the two the first session can actually hit.
  const wanted = new Set(['desert', backgroundTheme]);
  for (const bg of BACKGROUNDS) {
    if (bg.file && wanted.has(bg.id)) warm(getBackgroundUrl(bg.file));
  }
}
