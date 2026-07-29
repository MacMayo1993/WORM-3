// CubePreviewCanvas.jsx
// Drop-in <canvas> showing the real cube — your palette, your tile style, your
// piece count — drawn by the shared preview renderer. Use it anywhere the cube
// needs to appear outside the game: the setup wizards' hero plate, above all.
//
// The cube tumbles on its own so every face comes around, and takes a drag if
// you want to look at a particular one.

import React, { useRef, useEffect, useCallback } from 'react';
import {
  registerCubePreview,
  updateCubePreview,
  unregisterCubePreview
} from './CubePreviewRenderer.js';

// Render at up to 2× so the tile edges stay crisp on retina, but no further —
// every drawn frame costs a readback of size² pixels — and cap the absolute
// size for the same reason.
const MAX_RENDER_PX = 420;
const renderScale = () => Math.min(2, typeof window === 'undefined' ? 1 : window.devicePixelRatio || 1);

// How far a drag turns the cube: a full width of the plate is about one turn.
const DRAG_YAW = 0.011;
const DRAG_PITCH = 0.008;
const PITCH_LIMIT = 1.1;

/**
 * @param size          selected cubies per edge (2–15; Mega uses a 7×7 visual proxy)
 * @param colors        face id → hex, as returned by resolveColors
 * @param tileStyle     global tile style key, or 'random'
 * @param perFaceStyles optional face id → style overrides
 * @param px            CSS size in px (square)
 * @param animated      idle tumble — true for the hero plate, false for chips
 * @param interactive   let the player drag the cube around
 */
export default function CubePreviewCanvas({
  size = 3,
  colors,
  tileStyle = 'solid',
  perFaceStyles = null,
  px = 200,
  animated = true,
  interactive = true,
  style
}) {
  const canvasRef = useRef(null);
  const idRef = useRef(null);
  // Drag offsets live in a ref, not state: a pointermove that re-rendered React
  // would re-run every picker in the wizard sixty times a second.
  const orbit = useRef({ yaw: 0, pitch: 0 });
  const drag = useRef(null);
  const opts = useRef({});

  opts.current = { size, colors, tileStyle, perFaceStyles, animated };

  const push = useCallback(() => {
    if (idRef.current !== null) {
      updateCubePreview(idRef.current, { ...opts.current, yaw: orbit.current.yaw, pitch: orbit.current.pitch });
    }
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const renderPx = Math.min(MAX_RENDER_PX, Math.round(px * renderScale()));
    canvas.width = renderPx;
    canvas.height = renderPx;
    idRef.current = registerCubePreview(canvas, { ...opts.current, yaw: orbit.current.yaw, pitch: orbit.current.pitch });
    return () => {
      if (idRef.current !== null) unregisterCubePreview(idRef.current);
      idRef.current = null;
    };
    // Size changes remount the preview; the option effect below handles the rest.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [px]);

  useEffect(() => { push(); }, [size, colors, tileStyle, perFaceStyles, animated, push]);

  const onPointerDown = e => {
    if (!interactive) return;
    drag.current = { x: e.clientX, y: e.clientY };
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };

  const onPointerMove = e => {
    if (!drag.current) return;
    const dx = e.clientX - drag.current.x;
    const dy = e.clientY - drag.current.y;
    drag.current = { x: e.clientX, y: e.clientY };
    orbit.current.yaw += dx * DRAG_YAW;
    orbit.current.pitch = Math.max(-PITCH_LIMIT, Math.min(PITCH_LIMIT, orbit.current.pitch + dy * DRAG_PITCH));
    push();
  };

  const endDrag = e => {
    if (!drag.current) return;
    drag.current = null;
    e.currentTarget.releasePointerCapture?.(e.pointerId);
  };

  return (
    <canvas
      ref={canvasRef}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      style={{
        display: 'block',
        width: `${px}px`,
        height: `${px}px`,
        cursor: interactive ? 'grab' : 'default',
        touchAction: interactive ? 'none' : 'auto',
        ...style
      }}
    />
  );
}
