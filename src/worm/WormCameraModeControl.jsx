import React, { useId } from 'react';
import { useGameStore } from '../hooks/useGameStore.js';
import { FOLLOW_WORM, normalizeWormCameraMode, STATIONARY_WORM_CAMERA, STEADY_FOLLOW_WORM } from './wormCameraMode.js';

export default function WormCameraModeControl({ labelStyle, style }) {
  const id = useId();
  const mode = useGameStore(s => normalizeWormCameraMode(s.settings?.wormCameraMode));
  const setSettings = useGameStore(s => s.setSettings);
  return <>
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, ...style }}>
      <label htmlFor={id} style={labelStyle}>Camera mode</label>
      <select id={id} value={mode} style={SELECT_STYLE} aria-describedby={`${id}-help`}
        onChange={event => {
          const wormCameraMode = normalizeWormCameraMode(event.target.value);
          setSettings(s => ({ ...s, wormCameraMode }));
        }}>
        <option value={FOLLOW_WORM}>Follow worm</option>
        <option value={STEADY_FOLLOW_WORM}>Steady Follow</option>
        <option value={STATIONARY_WORM_CAMERA}>Stationary</option>
      </select>
    </div>
    <p id={`${id}-help`} style={HELP_STYLE}>{mode === STATIONARY_WORM_CAMERA
      ? 'Stationary holds a whole-cube view. Use the view arrows or “Far side” to see more of the cube without an animated turn.'
      : mode === STEADY_FOLLOW_WORM
        ? 'Tracks your worm without following its turns. Gameplay events can briefly move the camera; it stays outside during tunnels. Use the view arrows to change your angle.'
        : 'Follows the worm’s turns and rides through tunnels.'}</p>
  </>;
}

const SELECT_STYLE = { minHeight: 44, minWidth: 0, flex: 1, padding: '4px 8px', borderRadius: 8, font: 'inherit' };
const HELP_STYLE = { margin: '4px 0 10px', lineHeight: 1.35 };
