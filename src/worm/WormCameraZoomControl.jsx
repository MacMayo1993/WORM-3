import React, { useId } from 'react';
import { useGameStore } from '../hooks/useGameStore.js';
import { HEADING_FONT, ARCADE_INK, ARCADE_INK_STRONG, ARCADE_LINE, ARCADE_CARD } from '../utils/uiTheme.js';
import { WORM_CAMERA_ZOOM, clampWormCameraZoom, wormCameraZoomLabel } from './wormCameraZoom.js';

// One slider for the chase camera's distance, shared by the pause menu (where it
// can be judged against the run behind it) and Settings → Scene. It writes the
// persisted store value the camera reads every frame, so the view eases to the
// new distance live. The mouse wheel sets the same value while crawling.
export default function WormCameraZoomControl({ label = 'Camera', labelStyle, style }) {
  const id = useId();
  const zoom = useGameStore(s => clampWormCameraZoom(s.wormCameraZoom));
  const setZoom = useGameStore(s => s.setWormCameraZoom);
  const isDefault = Math.abs(zoom - WORM_CAMERA_ZOOM.default) < 0.001;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, ...style }}>
      <label htmlFor={id} style={labelStyle}>{label}</label>
      <span aria-hidden="true" style={HINT_STYLE}>Close</span>
      <input id={id} type="range" min={WORM_CAMERA_ZOOM.min} max={WORM_CAMERA_ZOOM.max} step={WORM_CAMERA_ZOOM.step}
        value={zoom} onChange={event => setZoom?.(Number(event.target.value))}
        aria-valuetext={`${wormCameraZoomLabel(zoom)} camera distance`}
        style={{ flex: 1, minWidth: 80, accentColor: ARCADE_INK, cursor: 'pointer' }} />
      <span aria-hidden="true" style={HINT_STYLE}>Far</span>
      <button type="button" onClick={() => setZoom?.(WORM_CAMERA_ZOOM.default)} disabled={isDefault}
        title="Back to the default distance" style={{ ...RESET_STYLE, opacity: isDefault ? 0.55 : 1 }}>
        {wormCameraZoomLabel(zoom)}
      </button>
    </div>
  );
}

const HINT_STYLE = { font: `700 10px/1 ${HEADING_FONT}`, color: ARCADE_INK_STRONG, opacity: 0.7, flexShrink: 0 };
const RESET_STYLE = {
  font: `800 11px/1 ${HEADING_FONT}`, minWidth: 54, minHeight: 36, padding: '6px 8px', borderRadius: 10,
  border: `2px solid ${ARCADE_LINE}`, background: ARCADE_CARD, color: ARCADE_INK_STRONG, cursor: 'pointer', flexShrink: 0,
};
