// src/components/screens/LoadingScreen.jsx
/**
 * LoadingScreen — the WORM³ loading cube levitating over a black-hole portal.
 *
 * A full-screen cover shown while a heavy mode/scene loads, so the player never
 * watches chunks parse or a 20MB environment map "pop in". The 3D cube is pure
 * CSS; beneath it, LoadingPortal draws a spinning vortex on a 2D <canvas> (2D,
 * not WebGL, so it never competes for a WebGL context with the app's R3F canvas).
 *
 * The cube uses the real game palette and antipodal face layout (Red↔Orange,
 * Green↔Blue, White↔Yellow on opposite faces — see constants.js).
 *
 * Props:
 *   label       — status line, e.g. "Entering Worm Mode". Default "Loading".
 *   sublabel    — kept for API symmetry; currently rendered as the label when set.
 *   progress    — 0–100 for a determinate bar; omit/null for an indeterminate one.
 *   showTitle   — render the WORM³ title card (default false).
 *   transparent — let the scene behind show through a blurred scrim (default false).
 *   leaving     — fade the cover out (parent drives this before unmount).
 *   style       — extra styles merged onto the root (z-index overrides, etc.).
 */

import React, { useEffect, useMemo, useState } from 'react';
import { UI_FONT, DISPLAY_FONT } from '../../utils/uiTheme.js';
import { renderTileImage } from '../../3d/TilePreviewRenderer.js';
import LoadingPortal from './LoadingPortal.jsx';
import './LoadingScreen.css';

const FACES = ['f-white', 'f-yellow', 'f-red', 'f-orange', 'f-green', 'f-blue'];

// Each face's game color (utils/constants.js COLORS), used to tint its tile.
const FACE_COLORS = {
  'f-white': '#fafafa',
  'f-yellow': '#eab308',
  'f-red': '#ef4444',
  'f-orange': '#f97316',
  'f-green': '#22c55e',
  'f-blue': '#3b82f6'
};

// A "supernice" slice of the real in-game tile catalog (tileStyleCatalog.js) —
// styles that read well as a still. Random mode assigns one per face; we do the
// same so the loading cube wears the game's actual materials, re-rolled each show.
const STYLE_POOL = [
  'metallic', 'holographic', 'galaxy', 'circuit', 'water', 'ice', 'oilSlick', 'liquidChrome',
  'prismBloom', 'auroraWeave', 'stellarLensing', 'carbonFiber', 'hexGrid', 'stainedGlass',
  'topographic', 'neonSign', 'constellation', 'lava'
];

function Face({ cls, tex }) {
  const stickerStyle = tex ? { backgroundImage: `url(${tex})` } : undefined;
  return (
    <div className={`wl-face ${cls}`}>
      {Array.from({ length: 9 }, (_, i) => (
        <div key={i} className="wl-sticker" style={stickerStyle} />
      ))}
    </div>
  );
}

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

  // Roll a random tile style per face (re-rolled each time the cover mounts) and
  // render each to an image via the shared renderer, so the cube wears the real
  // in-game materials. Falls back to flat glossy stickers when the shared
  // renderer isn't up yet (e.g. the boot cover, before the <Canvas> mounts).
  const faceStyles = useMemo(() => {
    const shuffled = [...STYLE_POOL].sort(() => Math.random() - 0.5);
    return FACES.reduce((acc, f, i) => ({ ...acc, [f]: shuffled[i % shuffled.length] }), {});
  }, []);
  const [faceTex, setFaceTex] = useState(null);
  useEffect(() => {
    const tex = {};
    let any = false;
    for (const f of FACES) {
      const img = renderTileImage(faceStyles[f], FACE_COLORS[f], 96);
      if (img) {
        tex[f] = img;
        any = true;
      }
    }
    if (any) setFaceTex(tex);
  }, [faceStyles]);

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

      <div className="wl-scene">
        <div className="wl-stage">
          <div className="wl-cube">
            {FACES.map((cls) => (
              <Face key={cls} cls={cls} tex={faceTex?.[cls]} />
            ))}
          </div>
        </div>
        <LoadingPortal />
      </div>

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
