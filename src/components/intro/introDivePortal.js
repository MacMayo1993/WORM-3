// src/components/intro/introDivePortal.js
// The portal the opening's cube dives through (introDive in introOutro.js).
//
// Two meshes lying on the paper's floor, in the intro root's frame:
//   mask — a ring with the portal's hole in it that writes depth only. It is
//          drawn after the paper (renderOrder -0.5) and before the cube (0), so
//          whatever of the cube has sunk below the floor is hidden everywhere
//          except through the hole, as if it had gone into the paper. Drawn
//          before the paper, it would punch holes in the paper instead.
//   disc — the vortex: the six face colours spiralling into a dark throat under
//          a bright rim. Transparent and drawn after the cube, it dims whatever
//          has sunk into the throat.
import * as THREE from 'three';
import { introColor } from './introMotion.js';

/** Portal radius per unit of the cube's half-width (its corners must clear the rim). */
export const PORTAL_RADIUS = 1.6;
const MASK_OUTER = 80;

const VERTEX = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;

const FRAGMENT = /* glsl */ `
uniform float uTime;
uniform float uOpen;
uniform vec3 uColors[6];
varying vec2 vUv;
const float TAU = 6.2831853;
void main() {
  vec2 p = vUv * 2.0 - 1.0;
  float r = length(p);
  float aa = fwidth(r) * 1.5;
  float inside = 1.0 - smoothstep(1.0 - aa, 1.0, r);
  if (inside <= 0.0) discard;
  float a = atan(p.y, p.x);
  // Arms wind inward and turn; each arm wears one face colour.
  float swirl = a / TAU + 0.55 * log(max(r, 0.02)) - uTime * 0.45;
  float band = fract(swirl * 6.0);
  int face = int(mod(floor(swirl * 6.0), 6.0));
  vec3 arm = uColors[0];
  for (int i = 1; i < 6; i++) if (i == face) arm = uColors[i];
  float armMask = smoothstep(0.0, 0.18, band) * (1.0 - smoothstep(0.55, 0.8, band));
  // Deeper is darker: the throat swallows the colour.
  float depth = smoothstep(0.85, 0.05, r);
  vec3 throat = vec3(0.07, 0.1, 0.09);
  vec3 color = mix(throat, arm, armMask * (1.0 - 0.8 * depth));
  // A bright lip in the arm colour, white at its crest.
  float lip = smoothstep(0.74, 0.9, r) * (1.0 - smoothstep(0.96, 1.0, r));
  color = mix(color, mix(arm, vec3(1.0), 0.55), lip);
  float alpha = inside * mix(0.92, 0.6, armMask * (1.0 - depth)) ;
  alpha = max(alpha, lip) * smoothstep(0.0, 0.25, uOpen);
  gl_FragColor = vec4(color, alpha);
  #include <colorspace_fragment>
}`;

/** Builds the portal's two meshes; `update` places them each frame. */
export function createDivePortal() {
  const discMaterial = new THREE.ShaderMaterial({
    name: 'IntroDivePortal',
    vertexShader: VERTEX,
    fragmentShader: FRAGMENT,
    uniforms: {
      uTime: { value: 0 },
      uOpen: { value: 0 },
      uColors: { value: [1, 2, 3, 4, 5, 6].map(id => new THREE.Color(introColor(id))) }
    },
    transparent: true,
    depthWrite: false,
    toneMapped: false
  });
  const disc = new THREE.Mesh(new THREE.CircleGeometry(1, 72), discMaterial);
  disc.name = 'IntroDivePortal';
  disc.rotation.x = -Math.PI / 2;
  disc.renderOrder = 1;
  disc.frustumCulled = false;
  disc.visible = false;

  const maskMaterial = new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: true });
  const mask = new THREE.Mesh(new THREE.RingGeometry(1, MASK_OUTER, 72, 1), maskMaterial);
  mask.name = 'IntroDiveMask';
  mask.rotation.x = -Math.PI / 2;
  mask.renderOrder = -0.4;
  mask.frustumCulled = false;
  mask.visible = false;

  return {
    disc,
    mask,
    /** `dive` from introDive; `floor` the paper's height; `halfWidth` the cube's. */
    update(dive, floor, halfWidth, time) {
      const radius = PORTAL_RADIUS * halfWidth * dive.portal;
      disc.visible = dive.portal > 0.002;
      mask.visible = disc.visible && dive.sink > 0;
      disc.position.y = floor + 0.02;
      mask.position.y = floor;
      disc.scale.setScalar(Math.max(radius, 1e-4));
      // The hole only: its outer edge reaches far past the frame at any opening.
      mask.scale.setScalar(Math.max(radius, 1e-4));
      discMaterial.uniforms.uTime.value = time;
      discMaterial.uniforms.uOpen.value = dive.portal;
    },
    dispose() {
      disc.geometry.dispose(); discMaterial.dispose();
      mask.geometry.dispose(); maskMaterial.dispose();
    }
  };
}
