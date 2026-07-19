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
// visits load from local cache (see VitePWA config). Registration is deferred
// until after first paint (window load + idle) so precaching the ~3MB shell
// never competes with the critical boot path. When a new deploy is ready we
// show a dismissible "update" toast instead of force-reloading (registerType:
// 'prompt' in vite.config.js) — the page only reloads if the user asks it to.
import { registerSW } from 'virtual:pwa-register'

const showUpdateToast = (reload) => {
  if (document.getElementById('worm3-update-toast')) return
  const toast = document.createElement('div')
  toast.id = 'worm3-update-toast'
  toast.setAttribute('role', 'status')
  toast.style.cssText = [
    'position:fixed', 'left:50%', 'bottom:20px', 'transform:translateX(-50%)',
    'z-index:99999', 'display:flex', 'align-items:center', 'gap:12px',
    'padding:10px 14px', 'border-radius:12px',
    'background:rgba(10,16,36,0.94)', 'color:#e8eeff',
    'border:1px solid rgba(120,160,255,0.28)',
    'box-shadow:0 8px 28px rgba(0,0,0,0.45)',
    'font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif',
    'font-size:13px', 'max-width:min(92vw,420px)',
  ].join(';')

  const label = document.createElement('span')
  label.textContent = 'A new version is ready.'
  label.style.cssText = 'flex:1;line-height:1.3'

  const refresh = document.createElement('button')
  refresh.type = 'button'
  refresh.textContent = 'Refresh'
  refresh.style.cssText = [
    'border:none', 'cursor:pointer', 'border-radius:8px',
    'padding:6px 14px', 'font:inherit', 'font-weight:700', 'color:#fff',
    'background:linear-gradient(135deg,#3b82f6,#6366f1)',
  ].join(';')
  refresh.addEventListener('click', () => reload())

  const dismiss = document.createElement('button')
  dismiss.type = 'button'
  dismiss.setAttribute('aria-label', 'Dismiss')
  dismiss.textContent = '✕'
  dismiss.style.cssText = [
    'border:none', 'cursor:pointer', 'background:transparent',
    'color:#9fb2e0', 'font:inherit', 'font-size:15px', 'padding:2px 4px',
  ].join(';')
  dismiss.addEventListener('click', () => toast.remove())

  toast.append(label, refresh, dismiss)
  document.body.appendChild(toast)
}

const registerServiceWorker = () => {
  const idle = window.requestIdleCallback || ((cb) => setTimeout(cb, 200))
  idle(() => {
    const updateSW = registerSW({
      onNeedRefresh() {
        showUpdateToast(() => updateSW(true))
      },
    })
  })
}
if (document.readyState === 'complete') registerServiceWorker()
else window.addEventListener('load', registerServiceWorker, { once: true })

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
