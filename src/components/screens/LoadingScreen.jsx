// src/components/screens/LoadingScreen.jsx
/**
 * LoadingScreen — the WORM³ loading cube.
 *
 * A lightweight, full-screen cover shown while a heavy mode/scene loads, so the
 * player never watches chunks parse or a 20MB environment map "pop in". It is
 * intentionally pure CSS (see LoadingScreen.css): no second WebGL context to
 * collide with the app's single R3F <Canvas>, and no canvas RAF loop to steal
 * CPU from the very decode it is covering.
 *
 * The 3D CSS cube uses the real game palette and antipodal face layout
 * (Red↔Orange, Green↔Blue, White↔Yellow on opposite faces — see constants.js).
 *
 * Props:
 *   label       — status line, e.g. "Entering Worm Mode". Default "Loading".
 *   sublabel    — kept for API symmetry; currently rendered as the label when set.
 *   progress    — 0–100 for a determinate bar; omit/null for an indeterminate one.
 *   showTitle   — render the WORM³ title card (default true).
 *   transparent — let the scene behind show through a blurred scrim (default false).
 *   leaving     — fade the cover out (parent drives this before unmount).
 *   style       — extra styles merged onto the root (z-index overrides, etc.).
 */

import React from 'react';
import { UI_FONT, DISPLAY_FONT } from '../../utils/uiTheme.js';
import './LoadingScreen.css';

const FACES = ['f-white', 'f-yellow', 'f-red', 'f-orange', 'f-green', 'f-blue'];

function Face({ cls }) {
  return (
    <div className={`wl-face ${cls}`}>
      {Array.from({ length: 9 }, (_, i) => (
        <div key={i} className="wl-sticker" />
      ))}
    </div>
  );
}

export default function LoadingScreen({
  label = 'Loading',
  sublabel,
  progress = null,
  showTitle = true,
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
      style={{ '--wl-display-font': DISPLAY_FONT, '--wl-ui-font': UI_FONT, ...style }}
    >
      {showTitle && (
        <div className="wl-title-card">
          <h1 className="wl-title">
            WORM<sup>3</sup>
          </h1>
          <div className="wl-title-sub">
            <span className="wl-line left" />
            <p>A Cube That Remembers</p>
            <span className="wl-line right" />
          </div>
        </div>
      )}

      <div className="wl-stage">
        <div className="wl-cube">
          {FACES.map((cls) => (
            <Face key={cls} cls={cls} />
          ))}
        </div>
      </div>
      <div className="wl-shadow" />

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
