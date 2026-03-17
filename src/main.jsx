import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './App.css' // Import App.css instead of index.css

// After a GitHub Pages deploy, hashed chunk filenames change. If the browser has
// cached the old HTML/JS, dynamic imports will 404. Reload once to pick up fresh chunks.
window.addEventListener('vite:preloadError', () => window.location.reload());

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)