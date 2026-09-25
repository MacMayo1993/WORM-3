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
  // Decals are rendered from real cubies and legal moves (scripts/carousel-art).
  // They stay ON the live mesh, turning and diving with the carousel cube.
  // Keep the vector underneath until loading succeeds, including offline visits.
  const asset = { worm: 'worm', freeplay: 'cube', cube: 'teach', chaos: 'chaos', random: 'random', store: 'store' }[mode];
  if (asset && typeof Image !== 'undefined') {
    const image = new Image();
    image.onload = () => {
      ctx.clearRect(0, 0, 160, 160);
      ctx.globalAlpha = 1;
      ctx.drawImage(image, 0, 0, 160, 160);
      texture.needsUpdate = true;
    };
    image.src = `${import.meta.env.BASE_URL}images/arcade/${asset}.webp`;
    texture.addEventListener('dispose', () => { image.onload = null; });
  }
  return texture;
}
