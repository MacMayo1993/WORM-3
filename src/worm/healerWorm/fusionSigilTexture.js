// src/worm/healerWorm/fusionSigilTexture.js
//
// A recipe's sigil (fusionSigils.js) as a small canvas texture: the glyph bright on
// dark enamel in a ring of the reaction's colour, the same picture the HUD shows.
// FusionAura floats it over the worm's head for the length of the wash. One texture
// per recipe, built once and kept (never disposed: thirty 128² canvases at most).
import * as THREE from 'three';
import { fusionLookOf } from './fusionLooks.js';
import { SIGIL_ICONS } from './fusionSigils.js';

const SIZE = 128;
const _cache = new Map();

/** The recipe's sigil texture, or null where there is no 2D canvas (tests, workers). */
export function fusionSigilTexture(recipe) {
  if (_cache.has(recipe)) return _cache.get(recipe);
  const look = fusionLookOf(recipe);
  const path = look && SIGIL_ICONS[look.sigil];
  let texture = null;
  const canvas = path && typeof document !== 'undefined' && typeof Path2D !== 'undefined' ? document.createElement('canvas') : null;
  const ctx = canvas?.getContext?.('2d');
  if (ctx) {
    canvas.width = canvas.height = SIZE;
    const k = SIZE / 24;
    ctx.clearRect(0, 0, SIZE, SIZE);
    ctx.beginPath();
    ctx.arc(SIZE / 2, SIZE / 2, SIZE / 2 - 6, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(23, 61, 42, 0.82)';
    ctx.fill();
    ctx.lineWidth = 8;
    ctx.strokeStyle = look.color;
    ctx.stroke();
    ctx.save();
    ctx.translate(SIZE / 2, SIZE / 2);
    ctx.scale(k * 0.66, k * 0.66);
    ctx.translate(-12, -12);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = 2.2;
    ctx.strokeStyle = look.sigilColor;
    ctx.shadowColor = look.glow;
    ctx.shadowBlur = 4;
    ctx.stroke(new Path2D(path));
    ctx.restore();
    texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
  }
  _cache.set(recipe, texture);
  return texture;
}

let _warm = null;
/**
 * A stand-in for the emblem's material (a basic material with an sRGB map), for
 * elementalWarmup.js: every recipe's emblem shares this one program, so linking it
 * while the board scrambles keeps the fuse from compiling mid-run.
 */
export function sigilEmblemWarmupMaterial() {
  if (!_warm) {
    const map = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1);
    map.colorSpace = THREE.SRGBColorSpace;
    map.needsUpdate = true;
    _warm = new THREE.MeshBasicMaterial({ map, transparent: true, depthWrite: false, toneMapped: false });
  }
  return _warm;
}
