import * as THREE from 'three';
import { modeArtwork } from '../utils/modeArtwork.js';

// Six small, static decals. They mount with the menu and are disposed on unmount;
// rotating the carousel only moves the existing meshes, never redraws a canvas.
export function createModePlateArtwork(mode, ink) {
  if (typeof document === 'undefined' || typeof Path2D === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 512;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.scale(512 / 160, 512 / 160);
  ctx.strokeStyle = ctx.fillStyle = ink;
  ctx.lineCap = ctx.lineJoin = 'round';
  for (const shape of modeArtwork(mode)) {
    ctx.globalAlpha = shape.opacity;
    const path = new Path2D(shape.d);
    if (shape.fill) ctx.fill(path);
    if (shape.width) { ctx.lineWidth = shape.width; ctx.stroke(path); }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  // Match the illustrated card when it fades into the live cube's launch dive.
  // The original line art remains a fallback while the image decodes.
  const image = new Image();
  image.onload = () => {
    ctx.clearRect(0, 0, 160, 160);
    ctx.drawImage(image, 0, 0, 160, 160);
    texture.needsUpdate = true;
  };
  image.src = `${import.meta.env.BASE_URL}images/arcade/${mode === 'cube' ? 'teach' : mode === 'worm' ? 'worm' : mode === 'chaos' ? 'chaos' : 'cube'}.webp`;
  texture.addEventListener('dispose', () => { image.onload = null; });
  return texture;
}
