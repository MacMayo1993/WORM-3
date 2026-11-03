import React from 'react'
import ReactDOM from 'react-dom/client'
// Every game face is self-hosted via Fontsource so it bundles with the app.
// They previously loaded from the Google Fonts CDN, which silently fell back to
// a default serif on any blocked/slow connection and destroyed the game's
// typography — never reintroduce a CDN <link> for fonts.
//
// Nunito is the body/UI face and Outfit is the heading face (see UI_FONT and
// HEADING_FONT in utils/uiTheme.js). Both are variable fonts: one file covers
// the whole weight axis, so asking for 800 costs nothing extra. Their
// @font-face rules are declared locally rather than imported from the package
// entry points — see the note at the top of fonts.css.
import './fonts.css'
import '@fontsource/bungee'
import nunitoWoff2 from '@fontsource-variable/nunito/files/nunito-latin-wght-normal.woff2?url'
import outfitWoff2 from '@fontsource-variable/outfit/files/outfit-latin-wght-normal.woff2?url'
import bungeeWoff2 from '@fontsource/bungee/files/bungee-latin-400-normal.woff2?url'

// Preload every webfont immediately — otherwise the browser only fetches a
// font when the first styled element renders, and on slow networks the
// fallback face is visible for seconds before swapping (ugly FOUT on the
// title screen). Nunito and Outfit come first: they carry
// every label in the game, so they are the two whose absence is most visible.
for (const href of [nunitoWoff2, outfitWoff2, bungeeWoff2]) {
  const link = document.createElement('link')
  link.rel = 'preload'
  link.as = 'font'
  link.type = 'font/woff2'
  link.crossOrigin = 'anonymous'
  link.href = href
  document.head.appendChild(link)
}
import App from './App.jsx'
import AppErrorBoundary from './components/AppErrorBoundary.jsx'
import { installChunkRecovery } from './utils/chunkRecovery.js'
import { installErrorCapture } from './utils/diagnostics.js'
import './App.css'
import './gameTypography.css'
import { UI_CSS_VARS } from './utils/uiTheme.js'

for (const [name, value] of Object.entries(UI_CSS_VARS)) {
  document.documentElement.style.setProperty(name, value)
}

// Keep the installed game checking for updates while open and after resume.
// Applying an update is always an explicit player action.
import { registerSW } from 'virtual:pwa-register'
import { installAppUpdates } from './utils/appUpdates.js'
installAppUpdates(registerSW)

// After a GitHub Pages deploy, hashed chunk filenames change and the old ones are
// deleted. A stale tab's next lazy import fails, so reload once to fetch a fresh
// index.html (see utils/chunkRecovery.js for the loop guard). Errors are kept in a
// small local log for the crash screen's "Copy details".
installErrorCapture()
installChunkRecovery()

ReactDOM.createRoot(document.getElementById('root')).render(
  <AppErrorBoundary>
    <App />
  </AppErrorBoundary>,
)
