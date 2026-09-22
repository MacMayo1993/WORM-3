import { useGameStore } from '../hooks/useGameStore.js';
import { resolveColors } from '../utils/colorSchemes.js';
import { registerDirectWormPreview, updateDirectWormPreview, unregisterDirectWormPreview } from './directWormPreview.js';
// WormPreviewCanvas.jsx
// Drop-in <canvas> that shows the real 3D worm — same body, face, and hat you
// see in Healer mode — drawn by the shared preview renderer. Use it anywhere a
// worm needs to appear outside the game: the character plate, the store's skin
// and hat cards, the cosmetic pickers.

import React, { useRef, useEffect, useLayoutEffect, useMemo } from 'react';
import {
  registerWormPreview,
  updateWormPreview,
  unregisterWormPreview,
} from './WormPreviewRenderer.js';

// Render at up to 2× so the beads stay round on retina, but no further — every
// preview costs a readback of size² pixels per drawn frame — and cap the
// absolute size for the same reason.
const MAX_RENDER_PX = 288;
const renderScale = (maxPixelRatio) => Math.min(maxPixelRatio, typeof window === 'undefined' ? 1 : (window.devicePixelRatio || 1));

/**
 * @param characterId  worm character ('classic', 'inch', …)
 * @param skinId       worm skin id
 * @param hatId        worm hat id ('none' for bare-headed)
 * @param size         CSS size in px (square)
 * @param maxPixelRatio  cap readback resolution for groups of animated previews
 * @param maxRenderPixels  backing-buffer limit; large character art can opt into sharper rendering
 * @param animated     idle motion — true for hero previews, false for chips
 * @param framing      'body' for thumbnails, 'character' for the selector stage, 'head' for hats
 */
export default function WormPreviewCanvas({
  characterId = 'classic',
  skinId = 'slime',
  hatId = 'none',
  accessories,
  size = 64,
  animated = false,
  direct = false,
  maxPixelRatio = 2,
  maxRenderPixels = MAX_RENDER_PX,
  framing = 'body',
  companion,
  style,
}) {
  const settings = useGameStore(s => s.settings);
  const palette = useMemo(() => resolveColors(settings || {}), [settings]);
  const canvasRef = useRef(null);
  const idRef = useRef(null);

  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (direct) {
      const entry = registerDirectWormPreview(canvas, { characterId, skinId, hatId, accessories, palette, animated, framing, companion });
      idRef.current = entry;
      return () => { unregisterDirectWormPreview(entry); idRef.current = null; };
    }
    const px = Math.min(maxRenderPixels, Math.round(size * renderScale(maxPixelRatio)));
    canvas.width = px;
    canvas.height = px;
    idRef.current = registerWormPreview(canvas, { characterId, skinId, hatId, accessories, palette, animated, framing, companion });
    return () => {
      if (idRef.current !== null) unregisterWormPreview(idRef.current);
      idRef.current = null;
    };
    // Size changes remount the preview; the option effect below handles the rest.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [size, maxPixelRatio, maxRenderPixels, direct]);

  useEffect(() => {
    if (idRef.current !== null) (direct ? updateDirectWormPreview : updateWormPreview)(idRef.current, { characterId, skinId, hatId, accessories, palette, animated, framing, companion });
  }, [characterId, skinId, hatId, accessories, palette, animated, framing, companion, direct]);

  const Surface = direct ? 'div' : 'canvas';
  return (
    <Surface
      ref={canvasRef}
      style={{ display: 'block', width: `${size}px`, height: `${size}px`, ...style }}
    />
  );
}
