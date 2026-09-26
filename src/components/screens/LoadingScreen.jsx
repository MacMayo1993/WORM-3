// src/components/screens/LoadingScreen.jsx
/**
 * LoadingScreen — the opening's Rubik's cube, hopping over a wormhole in the
 * opening's graph paper.
 *
 * A full-screen cover shown while a heavy mode/scene loads, so the player never
 * watches chunks parse or a 20MB environment map "pop in". This is the static
 * shell — cover, title card and status line. The animated cube and wormhole
 * (LoadingScene) are a lazy chunk with their own stylesheet: nothing needs them
 * before first render and the initial CSS budget has no room for them.
 * preloadAssets.js warms that chunk during the opening, and until it arrives the
 * cover holds the scene's space on plain paper so nothing jumps.
 *
 * Props:
 *   label       — status line, e.g. "Entering Worm Mode". Default "Loading".
 *   sublabel    — kept for API symmetry; currently rendered as the label when set.
 *   progress    — 0–100 for a determinate bar; omit/null for an indeterminate one.
 *   showTitle   — render the WORM³ title card (default false).
 *   transparent — let the scene behind show through the paper (default false).
 *   leaving     — fade the cover out (parent drives this before unmount).
 *   style       — extra styles merged onto the root (z-index overrides, etc.).
 */

import React, { Suspense } from 'react';
import WormWordmark from '../branding/WormWordmark.jsx';
import { UI_FONT, HEADING_FONT } from '../../utils/uiTheme.js';
import { RUBIKS_CLASSIC } from '../../utils/constants.js';
import './LoadingScreen.css';

const LoadingScene = React.lazy(() => import('./LoadingScene.jsx'));

// Holds the cube and wormhole's space while their chunk loads.
const ScenePlaceholder = () => (
  <div className="wl-scene">
    <div className="wl-stage" />
    <div className="wl-well" />
  </div>
);

// The classic sticker colours as CSS variables, so the stylesheets never restate them.
const PALETTE = Object.fromEntries(Object.entries(RUBIKS_CLASSIC).map(([name, hex]) => [`--wl-${name}`, hex]));

export default function LoadingScreen({
  label = 'Loading',
  sublabel,
  progress = null,
  showTitle = false,
  transparent = false,
  leaving = false,
  style
}) {
  const hasProgress = typeof progress === 'number' && Number.isFinite(progress);
  const pct = hasProgress ? Math.max(0, Math.min(100, Math.round(progress))) : null;
  const text = sublabel || label;

  const rootClass = ['wl-root', transparent ? 'wl-transparent' : '', leaving ? 'wl-leaving' : ''].filter(Boolean).join(' ');

  return (
    <div
      className={rootClass}
      role="status"
      aria-live="polite"
      aria-label={hasProgress ? `${text}, ${pct}%` : text}
      style={{ '--wl-heading-font': HEADING_FONT, '--wl-ui-font': UI_FONT, ...PALETTE, ...style }}
    >
      {showTitle && (
        <div className="wl-title-card">
          <h1 className="wl-title">
            <WormWordmark />
          </h1>
          <div className="wl-title-sub">
            <span className="wl-line" />
            <p>A new way around every corner.</p>
            <span className="wl-line" />
          </div>
        </div>
      )}

      <Suspense fallback={<ScenePlaceholder />}>
        <LoadingScene translucent={transparent} />
      </Suspense>

      <div className="wl-status">
        <p className="wl-label">
          {text}
          {!hasProgress && (
            <span className="wl-dots" aria-hidden="true">
              <i>.</i>
              <i>.</i>
              <i>.</i>
            </span>
          )}
        </p>
        <div
          className={`wl-bar ${hasProgress ? 'determinate' : 'indeterminate'}`}
          style={hasProgress ? { '--wl-progress': `${pct}%` } : undefined}
        >
          <i />
        </div>
      </div>
    </div>
  );
}
