// WormPreviewCanvas.jsx
// Drop-in <canvas> that shows the real 3D worm — same body, face, and hat you
// see in Healer mode — drawn by the shared preview renderer. Use it anywhere a
// worm needs to appear outside the game: the character plate, the store's skin
// and hat cards, the cosmetic pickers.

import React, { useRef, useEffect } from 'react';
import {
  registerWormPreview,
  updateWormPreview,
  unregisterWormPreview,
} from './WormPreviewRenderer.js';

// Render at up to 2× so the beads stay round on retina, but no further — every
// preview costs a readback of size² pixels per drawn frame — and cap the
// absolute size for the same reason.
const MAX_RENDER_PX = 288;
const renderScale = () => Math.min(2, typeof window === 'undefined' ? 1 : (window.devicePixelRatio || 1));

/**
 * @param characterId  worm character ('classic', 'inch', …)
 * @param skinId       worm skin id
 * @param hatId        worm hat id ('none' for bare-headed)
 * @param size         CSS size in px (square)
 * @param animated     idle motion — true for hero previews, false for chips
 * @param framing      'body' for the whole worm, 'head' for a hat portrait
 */
export default function WormPreviewCanvas({
  characterId = 'classic',
  skinId = 'slime',
  hatId = 'none',
  size = 64,
  animated = false,
  framing = 'body',
  style,
}) {
  const canvasRef = useRef(null);
  const idRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const px = Math.min(MAX_RENDER_PX, Math.round(size * renderScale()));
    canvas.width = px;
    canvas.height = px;
    idRef.current = registerWormPreview(canvas, { characterId, skinId, hatId, animated, framing });
    return () => {
      if (idRef.current !== null) unregisterWormPreview(idRef.current);
      idRef.current = null;
    };
    // Size changes remount the preview; the option effect below handles the rest.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [size]);

  useEffect(() => {
    if (idRef.current !== null) updateWormPreview(idRef.current, { characterId, skinId, hatId, animated, framing });
  }, [characterId, skinId, hatId, animated, framing]);

  return (
    <canvas
      ref={canvasRef}
      style={{ display: 'block', width: `${size}px`, height: `${size}px`, ...style }}
    />
  );
}
