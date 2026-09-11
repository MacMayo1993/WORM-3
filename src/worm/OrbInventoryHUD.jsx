// src/worm/OrbInventoryHUD.jsx
// Six stable face slots. Samples retain the real tile pattern so faces sharing
// a colour remain distinguishable; counts use their own neutral reading surface.

import React, { useEffect, useState, useRef } from 'react';
import '../components/menus/instrumentHud.css';
import { renderTileImage } from '../3d/TilePreviewRenderer.js';

const FACE_ORDER = [1, 2, 3, 4, 5, 6];
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

const FACE_NAMES = ['Front', 'Left', 'Top', 'Back', 'Right', 'Bottom'];

const OrbSlot = ({ color, styleKey, count, faceId }) => {
  const pattern = useTilePattern(styleKey, color);
  const previous = useRef(count);
  const [pickedUp, setPickedUp] = useState(false);
  useEffect(() => {
    const increased = count > previous.current;
    previous.current = count;
    if (!increased) return undefined;
    setPickedUp(true);
    const timer = setTimeout(() => setPickedUp(false), 360);
    return () => { clearTimeout(timer); setPickedUp(false); };
  }, [count]);
  return <div className={`orb-slot${count === 0 ? ' orb-slot-empty' : ''}${pickedUp ? ' orb-slot-pickup' : ''}`}
    role="listitem" aria-label={`${FACE_NAMES[faceId - 1]}: ${count} orbs`} title={FACE_NAMES[faceId - 1]}>
    <span className="orb-sample" aria-hidden="true" style={{ backgroundColor: color, backgroundImage: pattern ? `url(${pattern})` : 'none' }} />
    <span className="orb-slot-count" aria-hidden="true">{count}</span>
    <span className="orb-slot-face" aria-hidden="true">{FACE_NAMES[faceId - 1]}</span>
  </div>;
};

export default function OrbInventoryHUD({ orbInventory, faceColors, tileStyles, mobile = false }) {
  if (!orbInventory || !faceColors) return null;
  return <div className={`orb-reserve${mobile ? ' orb-reserve-mobile' : ''}`} role="list" aria-label="Orb reserve by face">
    {FACE_ORDER.map(faceId => <OrbSlot key={faceId} faceId={faceId} color={faceColors[faceId] ?? '#888888'}
      styleKey={tileStyles?.[faceId]} count={orbInventory[faceId] ?? 0} />)}
  </div>;
}
