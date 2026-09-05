// Deploy-base normalisation, shared by vite.config.js and its tests.
//
// Vite normalises `base` itself — it accepts `/preview`, `preview` or `/preview/`
// and serves all three from `/preview/`. Anything that *reuses* the raw value in a
// concatenation does not get that for free, and the PWA config does exactly that:
// `${BASE}index.html` and a media matcher built from the base. Given `/preview`
// those become `/previewindex.html` and `/previewenvironments/…`, so a preview
// build loses its navigation fallback and its runtime media cache while the app
// itself loads fine from `/preview/` — a silent, offline-only failure.
//
// Normalising once, here, keeps every consumer on the same string Vite serves.

/**
 * A deploy base guaranteed to start and end with `/` (or, for an absolute URL
 * base such as a CDN origin, to end with `/`).
 *
 * @param {string} raw - e.g. `/preview`, `preview/`, `https://cdn.example.com/app`
 * @returns {string} e.g. `/preview/`, `/preview/`, `https://cdn.example.com/app/`
 */
export function normalizeBase(raw) {
  const trimmed = (raw ?? '').trim();
  if (!trimmed || trimmed === '/') return '/';

  // An absolute URL is a legal Vite base; it needs the trailing slash but must not
  // gain a leading one.
  const isAbsolute = /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed) || trimmed.startsWith('//');
  const withLeading = isAbsolute || trimmed.startsWith('/') ? trimmed : `/${trimmed}`;

  return withLeading.endsWith('/') ? withLeading : `${withLeading}/`;
}
