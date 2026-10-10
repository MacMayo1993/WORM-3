// src/3d/stickerWormMaterials.js
// The two shared programs every ghost worm draws with (StickerWorm.jsx). They are
// module-level and never disposed; the WORM warm-up compiles them before the first
// flipped tile shows its worms (the glow reads RGBA vertex colours).
import * as THREE from 'three';

const FREQ = 4.2;
const SEG_LAG = 0.7;
export const STICKER_WORM_AMP = 0.028;

export const stickerWormTime = { value: 0 };

export const stickerWormBodyMaterial = new THREE.ShaderMaterial({
  uniforms: { uTime: stickerWormTime },
  vertexShader: `
    attribute vec3 aColor;
    attribute float aSeg;
    attribute float aPhase;
    attribute float aAmp;
    uniform float uTime;
    varying vec3 vColor;
    void main() {
      vColor = aColor;
      vec3 p = position;
      p.y += sin(uTime * ${FREQ.toFixed(1)} - aSeg * ${SEG_LAG.toFixed(1)} + aPhase) * aAmp;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
    }
  `,
  fragmentShader: `
    varying vec3 vColor;
    void main() {
      gl_FragColor = vec4(vColor, 1.0);
      #include <colorspace_fragment>
    }
  `,
  toneMapped: false
});

// Soft additive glow so ghost worms read clearly above busy tile art. RGBA vertex
// colours carry each glow's own opacity (head brighter than the body).
export const stickerWormGlowMaterial = new THREE.MeshBasicMaterial({
  vertexColors: true,
  transparent: true,
  blending: THREE.AdditiveBlending,
  depthWrite: false,
  toneMapped: false
});
