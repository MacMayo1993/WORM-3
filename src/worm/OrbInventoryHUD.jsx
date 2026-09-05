// src/worm/OrbInventoryHUD.jsx
// The orb reserve — one coin per face colour, with the count the worm is
// carrying. Renders as a bare row (no panel of its own): it is the second row
// of the worm HUD's status bar, so the surface, blur and border belong to that
// bar. It used to draw its own white card, which stacked a second floating
// panel under the top strip and repeated the total already shown there.
//
// Each coin wears its face's actual TILE STYLE, not just its colour: on a board
// where two faces share a hue and differ by pattern, a row of flat discs said
// nothing about what the worm was carrying. The pattern is a one-shot snapshot
// of the real tile shader (renderTileImage, on the main renderer — no second
// WebGL context) cached per style+colour for the session, so a full reserve row
// costs at most six renders in a run rather than six a frame. Solid faces skip
// it and keep the plain coin.

import React, { useEffect, useState } from 'react';
import { UI_FONT, NIGHT_TEXT, NIGHT_TEXT_MUTED } from '../utils/uiTheme.js';
import { renderTileImage } from '../3d/TilePreviewRenderer.js';

const FACE_ORDER = [1, 2, 3, 4, 5, 6];
const FONT = UI_FONT;
const PATTERN_PX = 64; // snapshot resolution — coins draw at ~30 CSS px

// style+colour → data URL. Module-level so the row keeps its patterns across
// remounts (death, restart) instead of re-rendering them every time.
const _patternCache = new Map();

/**
 * The tile pattern for one face, or null for solid faces and until the main
 * <Canvas> is up (renderTileImage returns null before the renderer is shared).
 * Retries a few times so a coin that mounts during the scramble still fills in.
 */
function useTilePattern(styleKey, colorHex) {
  const key = `${styleKey}_${colorHex}`;
  const [url, setUrl] = useState(() => _patternCache.get(key) ?? null);

  useEffect(() => {
    if (!styleKey || styleKey === 'solid' || !colorHex) {
      setUrl(null);
      return undefined;
    }
    const cached = _patternCache.get(key);
    if (cached) {
      setUrl(cached);
      return undefined;
    }
    let cancelled = false;
    let timer = null;
    const attempt = (triesLeft) => {
      if (cancelled) return;
      const image = renderTileImage(styleKey, colorHex, PATTERN_PX);
      if (image) {
        _patternCache.set(key, image);
        setUrl(image);
        return;
      }
      if (triesLeft > 0) timer = setTimeout(() => attempt(triesLeft - 1), 400);
    };
    attempt(6);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [key, styleKey, colorHex]);

  return url;
}

const OrbCoin = ({ color, styleKey, count, coinSize, fontSize }) => {
  const empty = count === 0;
  const pattern = useTilePattern(styleKey, color);
  // The highlight sits on top either way, so a patterned coin still reads as a
  // domed disc rather than a flat sticker punched into a circle.
  const highlight = 'radial-gradient(circle at 34% 28%, rgba(255,255,255,0.45) 0%, rgba(255,255,255,0) 48%)';
  return (
    <div
      style={{
        position: 'relative',
        width: coinSize,
        height: coinSize,
        borderRadius: '50%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        background: pattern ? `${highlight}, url(${pattern}) center/cover` : `${highlight}, ${color}`,
        border: '1.5px solid rgba(255, 253, 242, 0.55)',
        boxShadow: '0 2px 6px rgba(10, 14, 8, 0.45), inset 0 -2px 4px rgba(0, 0, 0, 0.28)',
        // A colour the worm is not carrying keeps its place in the row, dimmed:
        // the gap is the information — which face you still need — and a row that
        // reflows every pickup is a row you have to re-read every pickup.
        opacity: empty ? 0.26 : 1,
        filter: empty ? 'saturate(0.5)' : 'none',
        transition: 'opacity 0.2s ease, filter 0.2s ease',
      }}
    >
      <span
        style={{
          fontSize,
          fontWeight: 800,
          fontFamily: FONT,
          fontVariantNumeric: 'tabular-nums',
          color: '#ffffff',
          lineHeight: 1,
          // A patterned coin can be light anywhere under the digits, so the count
          // carries a heavier shadow than a flat one needed.
          textShadow: '0 1px 3px rgba(0, 0, 0, 0.85), 0 0 6px rgba(0, 0, 0, 0.6)',
        }}
      >
        {empty ? '·' : count}
      </span>
    </div>
  );
};

export default function OrbInventoryHUD({ orbInventory, faceColors, tileStyles, mobile = false }) {
  if (!orbInventory || !faceColors) return null;

  const coinSize = mobile ? 26 : 30;
  const coinFont = mobile ? 11 : 13;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: mobile ? 8 : 12, minWidth: 0, flex: '1 1 auto' }}>
      <span
        style={{
          fontSize: 8,
          color: NIGHT_TEXT_MUTED,
          letterSpacing: '0.14em',
          textTransform: 'uppercase',
          fontFamily: FONT,
          fontWeight: 700,
          flexShrink: 0,
        }}
      >
        Reserve
      </span>

      {/* All six faces, spread across the bar. The row used to hold only the
          colours the worm was carrying, packed against the label — which left two
          thirds of the strip empty on a fresh run and shuffled the coins under the
          player's eye every time a new colour was picked up. Six fixed positions
          spend the width the bar already has and read as an inventory: what you
          hold, and what you are still missing. */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: mobile ? 6 : 8,
          flex: '1 1 auto',
          minWidth: 0,
          color: NIGHT_TEXT,
        }}
      >
        {FACE_ORDER.map((faceId) => (
          <OrbCoin
            key={faceId}
            color={faceColors[faceId] ?? '#888888'}
            styleKey={tileStyles?.[faceId]}
            count={orbInventory[faceId] ?? 0}
            coinSize={coinSize}
            fontSize={coinFont}
          />
        ))}
      </div>
    </div>
  );
}
