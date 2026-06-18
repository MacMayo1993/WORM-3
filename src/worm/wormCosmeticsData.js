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
  { id: 'toxic',  label: 'Toxic',  body: '#a3e635', belly: '#65a30d', antenna: '#d9f99d', glow: '#bef264' },
  { id: 'bubble', label: 'Bubblegum', body: '#f9a8d4', belly: '#db2777', antenna: '#fce7f3', glow: '#f472b6' },
  { id: 'galaxy', label: 'Galaxy', body: '#7c3aed', belly: '#5b21b6', antenna: '#ddd6fe', glow: '#a78bfa' },
  { id: 'coral',  label: 'Coral',  body: '#fb7185', belly: '#e11d48', antenna: '#fecdd3', glow: '#fda4af' },
  { id: 'mono',   label: 'Mono',   body: '#e5e7eb', belly: '#9ca3af', antenna: '#f9fafb', glow: '#d1d5db' },
  { id: 'sunset', label: 'Sunset', body: '#f97316', belly: '#be185d', antenna: '#fdba74', glow: '#fb7185' },
  { id: 'emerald', label: 'Emerald', body: '#10b981', belly: '#047857', antenna: '#a7f3d0', glow: '#34d399' }
];

export const WORM_HATS = [
  { id: 'none',   label: 'None' },
  { id: 'tophat', label: 'Top Hat' },
  { id: 'party',  label: 'Party' },
  { id: 'crown',  label: 'Crown' },
  { id: 'halo',   label: 'Halo' },
  { id: 'beanie', label: 'Beanie' },
  { id: 'wizard', label: 'Wizard' },
  { id: 'flower', label: 'Flower' },
  { id: 'grad',   label: 'Grad Cap' }
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
