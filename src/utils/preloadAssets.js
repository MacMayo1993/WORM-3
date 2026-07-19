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

export function preloadAppAssets() {
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

  // NOTE: environment maps are deliberately NOT warmed here. They're 20–26MB
  // each, so a background warm on every cold session was fighting the critical
  // boot path for bandwidth — and because CacheFirst doesn't dedupe in-flight
  // requests, the warm fetch() raced the real EXR loader and pulled the same
  // huge file twice. The real loader (InteractivePhotoBackground in GameScene)
  // is now the only thing that fetches an env map; the demo's desert map is
  // warmed on demand via warmDemoAssets() when the player signals intent.
}

// Warm the demo's desert environment map. Called on Start Demo hover/press so
// the map is in cache by the time the demo scene mounts, without every cold
// session paying for a 2.2MB fetch it will never use.
let demoWarmed = false;
export function warmDemoAssets() {
  if (demoWarmed) return;
  demoWarmed = true;
  const desert = BACKGROUNDS.find((bg) => bg.id === 'desert');
  if (desert?.file) warm(getBackgroundUrl(desert.file));
}
