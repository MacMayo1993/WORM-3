// src/worm/wormGlowHalo.js
//
// The Glow Worm's halo — the light that spills OUTSIDE its body.
//
// ── Why not the previous halo, and why not emission ──────────────────────────
// The first version was an additive SPHERE at 1.4x the bead on every other
// segment. A solid halo wider than the bead it sits on cannot stay hidden behind
// it: the parts occluded by neighbouring beads were depth-rejected, and the
// surviving crescents squeezed out of every joint as spikes growing off the worm.
// Raising the sphere's segment count only made the spikes rounder — the shape was
// the problem, not the faceting.
//
// Emission alone was then tried and is not enough on its own: it makes the body
// brighter, but a glow is light spilling PAST the silhouette, and emission by
// definition stops at it. In play there is a bloom pass, but it is deliberately
// subtle (intensity 0.12 at a 0.86 luminance threshold) so the cube's own tiles do
// not smear, and the character picker is a standalone renderer with no
// post-processing at all.
//
// So: a camera-facing quad with a radial falloff to zero alpha. Two properties do
// all the work:
//   • it always faces the camera, so it has no silhouette to poke out at an angle
//   • its alpha reaches zero before its own edge, so there is no rim to clip
// which together mean it can be far LARGER than the bead — big enough to read as
// a glow — and still never produce a hard shape.
//
// Both worm renderers share this, so the picker and the game glow identically.

import * as THREE from 'three';

/**
 * Halo width as a multiple of the bead's radius. Large on purpose.
 *
 * The falloff is the reason it has to be: alpha is already down to ~0.1 at 0.65 of
 * the quad's half-width and zero at its edge, so a halo only slightly wider than
 * the bead spends its entire visible range hidden behind the bead. The glow has to
 * be several bead-radii across before any of it clears the body, which is exactly
 * the property that also makes it safe — nothing with a hard edge is ever drawn.
 */
export const HALO_SCALE = 8.0;

const _cache = { tex: undefined, mat: null, geo: null };

/**
 * Soft radial glow, hot in the middle with a long tail.
 *
 * The stops matter: a linear ramp reads as a hard-edged disc, which is the exact
 * failure mode this whole module exists to avoid.
 */
export function getWormHaloTexture() {
  if (_cache.tex !== undefined) return _cache.tex;
  if (typeof document === 'undefined') {
    _cache.tex = null;
    return null;
  }
  const S = 128;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = S;
  const ctx = canvas.getContext('2d');
  const g = ctx.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  g.addColorStop(0.0, 'rgba(255,255,255,1)');
  g.addColorStop(0.16, 'rgba(255,255,255,0.72)');
  g.addColorStop(0.42, 'rgba(255,255,255,0.26)');
  g.addColorStop(0.72, 'rgba(255,255,255,0.06)');
  g.addColorStop(1.0, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, S, S);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.minFilter = THREE.LinearFilter;
  tex.generateMipmaps = false;
  _cache.tex = tex;
  return tex;
}

/** A unit quad for the instanced billboard. Shared; never disposed by a consumer. */
export function getWormHaloGeometry() {
  if (!_cache.geo) {
    const geo = new THREE.InstancedBufferGeometry();
    const position = new Float32Array([-0.5, -0.5, 0, 0.5, -0.5, 0, 0.5, 0.5, 0, -0.5, 0.5, 0]);
    const uv = new Float32Array([0, 0, 1, 0, 1, 1, 0, 1]);
    geo.setAttribute('position', new THREE.BufferAttribute(position, 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    geo.setIndex(new THREE.BufferAttribute(new Uint16Array([0, 1, 2, 0, 2, 3]), 1));
    _cache.geo = geo;
  }
  return _cache.geo;
}

const vertexShader = /* glsl */`
  uniform float uScale;
  varying vec2 vUv;
  void main() {
    vUv = uv;
    #ifdef USE_INSTANCING
      mat4 m = modelMatrix * instanceMatrix;
    #else
      mat4 m = modelMatrix;
    #endif
    // Anchor at the segment, then step out along the CAMERA's axes. This is what
    // makes the halo face the viewer from every angle, which in turn is why it can
    // never present an edge-on silhouette between two beads.
    vec4 anchor = m * vec4(0.0, 0.0, 0.0, 1.0);
    float s = length(m[0].xyz) * uScale;
    vec3 right = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);
    vec3 up    = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);
    vec3 world = anchor.xyz + right * position.x * s + up * position.y * s;
    gl_Position = projectionMatrix * viewMatrix * vec4(world, 1.0);
  }
`;

const fragmentShader = /* glsl */`
  precision mediump float;
  uniform sampler2D uTex;
  uniform vec3 uColor;
  uniform float uOpacity;
  varying vec2 vUv;
  void main() {
    float a = texture2D(uTex, vUv).a;
    gl_FragColor = vec4(uColor * a, a * uOpacity);
  }
`;

/**
 * The shared instanced-billboard material. One worm is ever equipped at a time, so
 * a single cached material with colour/opacity uniforms is enough — callers set
 * them rather than building their own.
 */
export function getWormHaloMaterial() {
  if (!_cache.mat) {
    _cache.mat = new THREE.ShaderMaterial({
      uniforms: {
        uTex: { value: getWormHaloTexture() },
        uColor: { value: new THREE.Color('#ffffff') },
        uOpacity: { value: 0.85 },
        uScale: { value: HALO_SCALE }
      },
      vertexShader,
      fragmentShader,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false
    });
  }
  return _cache.mat;
}

/**
 * A single camera-facing halo for the vanilla-three preview, which has no
 * instancing set up and only a handful of segments — three.js Sprites already
 * billboard, so there is no reason to hand-roll it there.
 */
export function makeWormHaloSprite() {
  const mat = new THREE.SpriteMaterial({
    map: getWormHaloTexture(),
    color: 0xffffff,
    transparent: true,
    opacity: 0.85,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false
  });
  const sprite = new THREE.Sprite(mat);
  sprite.visible = false;
  return sprite;
}
