import React from 'react'
import ReactDOM from 'react-dom/client'
// Bungee display face, self-hosted via Fontsource so it bundles with the app.
// It previously loaded from the Google Fonts CDN, which silently fell back to
// a default serif on any blocked/slow connection and destroyed the game's
// typography — never reintroduce a CDN <link> for fonts.
import '@fontsource/bungee'
import App from './App.jsx'
import './App.css' // Import App.css instead of index.css

// After a GitHub Pages deploy, hashed chunk filenames change. If the browser has
// cached the old HTML/JS, dynamic imports will 404. Reload once to pick up fresh chunks.
window.addEventListener('vite:preloadError', () => window.location.reload());

ReactDOM.createRoot(document.getElementById('root')).render(
  <App />,
)
