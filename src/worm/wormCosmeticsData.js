// src/worm/wormCosmeticsData.js
// Skin and hat data — pure constants, no JSX.

import * as THREE from 'three';

export const WORM_SKINS = [
  { id: 'slime',  label: 'Slime',  body: '#00ff88', belly: '#00cc66', antenna: '#88ffbb', glow: '#00ff88' },
  { id: 'royal',  label: 'Royal',  body: '#a855f7', belly: '#7e22ce', antenna: '#c4b5fd', glow: '#a855f7' },
  { id: 'lava',   label: 'Lava',   body: '#f97316', belly: '#ea580c', antenna: '#fed7aa', glow: '#f97316' },
  { id: 'ocean',  label: 'Ocean',  body: '#06b6d4', belly: '#0891b2', antenna: '#a5f3fc', glow: '#22d3ee' },
  { id: 'gold',   label: 'Gold',   body: '#f59e0b', belly: '#d97706', antenna: '#fde68a', glow: '#fbbf24' },
  { id: 'cherry', label: 'Cherry', body: '#ec4899', belly: '#db2777', antenna: '#fbcfe8', glow: '#f472b6' },
  { id: 'ice',    label: 'Ice',    body: '#bae6fd', belly: '#7dd3fc', antenna: '#e0f2fe', glow: '#38bdf8' },
  { id: 'void',   label: 'Void',   body: '#6366f1', belly: '#4338ca', antenna: '#c7d2fe', glow: '#818cf8' },
];

export const WORM_HATS = [
  { id: 'none',   label: 'None',    emoji: '—' },
  { id: 'tophat', label: 'Top Hat', emoji: '🎩' },
  { id: 'party',  label: 'Party',   emoji: '🎉' },
  { id: 'crown',  label: 'Crown',   emoji: '👑' },
  { id: 'halo',   label: 'Halo',    emoji: '😇' },
];

export function getSkin(id) {
  return WORM_SKINS.find(s => s.id === id) ?? WORM_SKINS[0];
}

export function getHat(id) {
  return WORM_HATS.find(h => h.id === id) ?? WORM_HATS[0];
}

// Pre-allocated scratch for WormFace hat orientation — no per-frame allocations
export const _hatAlignQuat = new THREE.Quaternion();
export const _hatYUp = new THREE.Vector3(0, 1, 0);
