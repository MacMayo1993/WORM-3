// src/3d/DisparityHealthBar.jsx
// Thin flip-pressure bar at the bottom edge of a sticker face.
// Visible only during Disparity Mode on live tiles (not dead/headstoned).
// Pure component — only re-renders when flips or flipCap changes.
//
// Track, fill and the last-flip warning pip are one quad shaded in one shared
// program, its state baked into a geometry cached per (flips, cap). It used to be
// three meshes with their own materials and a new PlaneGeometry per flip, and
// Chaos keeps a bar on every flipped tile.
import React from 'react';
import * as THREE from 'three';
import { healthBarMaterial as material, W, H, TOP } from './disparityHealthBarMaterial.js';


const cache = new Map();
const _c = new THREE.Color();

function barGeometry(flips, flipCap) {
  const key = `${flips}|${flipCap}`;
  let geo = cache.get(key);
  if (geo) return geo;
  const pct = Math.min(flips / flipCap, 1);
  const flashing = flipCap - flips <= 1;
  _c.set(pct < 0.33 ? '#22c55e' : pct < 0.66 ? '#f97316' : '#ef4444');
  const top = flashing ? TOP : H / 2;
  geo = new THREE.PlaneGeometry(W, top + H / 2);
  geo.translate(0, (top - H / 2) / 2, 0);
  geo.deleteAttribute('normal');
  geo.deleteAttribute('uv');
  const n = geo.attributes.position.count;
  const fill = new Float32Array(n * 4), state = new Float32Array(n * 2);
  for (let i = 0; i < n; i++) {
    fill.set([_c.r, _c.g, _c.b, flashing ? 1 : 0.85], i * 4);
    state.set([pct, flashing ? 1 : 0], i * 2);
  }
  geo.setAttribute('aFill', new THREE.BufferAttribute(fill, 4));
  geo.setAttribute('aState', new THREE.BufferAttribute(state, 2));
  cache.set(key, geo);
  return geo;
}

const DisparityHealthBar = React.memo(function DisparityHealthBar({ flips, flipCap }) {
  if (!(flips > 0) || !(flipCap > 0)) return null;
  return (
    <mesh position={[0, -0.41, 0.002]} geometry={barGeometry(flips, flipCap)} material={material}
      raycast={() => null} dispose={null} />
  );
});

export default DisparityHealthBar;
