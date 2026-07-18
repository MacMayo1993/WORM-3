import React from 'react'
import ReactDOM from 'react-dom/client'
// Bungee display face, self-hosted via Fontsource so it bundles with the app.
// It previously loaded from the Google Fonts CDN, which silently fell back to
// a default serif on any blocked/slow connection and destroyed the game's
// typography — never reintroduce a CDN <link> for fonts.
import '@fontsource/bungee'
// Mobi's handwritten pencil dialogue face — same self-hosted rule as Bungee.
import '@fontsource/annie-use-your-telescope'
import bungeeWoff2 from '@fontsource/bungee/files/bungee-latin-400-normal.woff2?url'
import annieWoff2 from '@fontsource/annie-use-your-telescope/files/annie-use-your-telescope-latin-400-normal.woff2?url'

// Preload both webfonts immediately — otherwise the browser only fetches a
// font when the first styled element renders, and on slow networks the
// fallback face is visible for seconds before swapping (ugly FOUT on the
// title screen and Mobi dialogue).
for (const href of [bungeeWoff2, annieWoff2]) {
  const link = document.createElement('link')
  link.rel = 'preload'
  link.as = 'font'
  link.type = 'font/woff2'
  link.crossOrigin = 'anonymous'
  link.href = href
  document.head.appendChild(link)
}
import App from './App.jsx'
import './App.css' // Import App.css instead of index.css

// Service worker: precaches the app shell so deploys are atomic and repeat
// visits load from local cache (see VitePWA config). autoUpdate swaps in new
// versions in the background.
import { registerSW } from 'virtual:pwa-register'
registerSW({ immediate: true })

// After a GitHub Pages deploy, hashed chunk filenames change. If the browser has
// cached the old HTML/JS, dynamic imports will 404. Reload to pick up fresh chunks —
// but at most twice per tab: right after a deploy the Pages CDN can keep serving the
// stale index.html for several minutes, and an unguarded reload spins forever.
const CHUNK_RELOAD_KEY = 'worm3_chunk_reload';
window.addEventListener('vite:preloadError', async () => {
  const attempts = Number(sessionStorage.getItem(CHUNK_RELOAD_KEY) || '0');
  if (attempts >= 2) return; // stop looping; the import error surfaces instead
  sessionStorage.setItem(CHUNK_RELOAD_KEY, String(attempts + 1));
  // Re-fetch index.html bypassing the HTTP cache first — a plain reload happily
  // reuses the stale cached index that references the deleted chunks.
  try { await fetch(window.location.href, { cache: 'reload' }); } catch { /* offline — reload anyway */ }
  window.location.reload();
});
// App survived 30s — chunks are consistent; allow future deploys to reload again.
setTimeout(() => sessionStorage.removeItem(CHUNK_RELOAD_KEY), 30000);

ReactDOM.createRoot(document.getElementById('root')).render(
  <App />,
)
