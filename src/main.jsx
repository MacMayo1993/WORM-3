import React from 'react'
import ReactDOM from 'react-dom/client'
// Bungee display face, self-hosted via Fontsource so it bundles with the app.
// It previously loaded from the Google Fonts CDN, which silently fell back to
// a default serif on any blocked/slow connection and destroyed the game's
// typography — never reintroduce a CDN <link> for fonts.
import '@fontsource/bungee'
// Mobi's handwritten pencil dialogue face — same self-hosted rule as Bungee.
import '@fontsource/annie-use-your-telescope'
import App from './App.jsx'
import './App.css' // Import App.css instead of index.css

// After a GitHub Pages deploy, hashed chunk filenames change. If the browser has
// cached the old HTML/JS, dynamic imports will 404. Reload to pick up fresh chunks —
// but at most twice per tab: right after a deploy the Pages CDN can keep serving the
// stale index.html for several minutes, and an unguarded reload spins forever.
const CHUNK_RELOAD_KEY = 'worm3_chunk_reload';
window.addEventListener('vite:preloadError', () => {
  const attempts = Number(sessionStorage.getItem(CHUNK_RELOAD_KEY) || '0');
  if (attempts >= 2) return; // stop looping; the import error surfaces instead
  sessionStorage.setItem(CHUNK_RELOAD_KEY, String(attempts + 1));
  window.location.reload();
});
// App survived 30s — chunks are consistent; allow future deploys to reload again.
setTimeout(() => sessionStorage.removeItem(CHUNK_RELOAD_KEY), 30000);

ReactDOM.createRoot(document.getElementById('root')).render(
  <App />,
)
