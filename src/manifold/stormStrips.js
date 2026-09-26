// src/manifold/stormStrips.js
//
// Every electric line in the chaos storm — bolt leaders, return strokes, forks,
// and the surges that run down a wormhole — is a camera-facing strip in ONE
// merged buffer, drawn in one call (two with the x-ray pass).
//
// The old ChaosWave drew each bolt as a pair of THREE.Line objects. WebGL ignores
// line width, so a bolt was a one-pixel hairline however hard it was supposed to
// hit, and every bolt mounted its own React subtree and geometry. Here a strip is
// expanded to a real world-space width in the vertex shader (the same technique
// RestingCords uses for its cords), with a white-hot core and a coloured halo
// shaped in the fragment shader, and all strips live in one preallocated pool.
//
// Per frame the storm packs its live strips into slots 0..n-1 and clamps the draw
// range, so an idle storm draws nothing and nothing is ever allocated.

import * as THREE from 'three';

/** Points per strip. Shorter strips pad the tail with zero-width degenerates. */
export const STRIP_POINTS = 16;
const VERTS_PER_STRIP = STRIP_POINTS * 2;
const INDICES_PER_STRIP = (STRIP_POINTS - 1) * 6;
const DYNAMIC_ATTRS = ['position', 'aTangent', 'aColor', 'aWidth', 'aAlpha', 'aCore', 'aXray'];

const vertexShader = `
  attribute float aSide;
  attribute vec3  aTangent;
  attribute float aWidth;
  attribute vec3  aColor;
  attribute float aAlpha;
  attribute float aCore;
  attribute float aXray;

  uniform float uXrayPass;

  varying float vSide;
  varying vec3  vColor;
  varying float vAlpha;
  varying float vCore;

  void main() {
    vSide  = aSide;
    vColor = aColor;
    vCore  = aCore;
    vAlpha = uXrayPass > 0.5 ? aAlpha * aXray : aAlpha;

    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    // Expand the centreline into a screen-facing ribbon. A zero tangent (a padded
    // degenerate point) must not normalise to NaN — it has zero width anyway.
    vec3  tv = mat3(modelViewMatrix) * aTangent;
    float tl = length(tv);
    tv = tl > 1e-5 ? tv / tl : vec3(0.0, 1.0, 0.0);
    vec3  c  = cross(tv, vec3(0.0, 0.0, 1.0));
    float cl = length(c);
    vec3  perp = cl > 1e-4 ? c / cl : vec3(1.0, 0.0, 0.0);
    mv.xyz += perp * (aSide * aWidth * 0.5);
    gl_Position = projectionMatrix * mv;
  }
`;

const fragmentShader = `
  uniform float uXrayPass;
  uniform float uXrayAlpha;

  varying float vSide;
  varying vec3  vColor;
  varying float vAlpha;
  varying float vCore;

  void main() {
    // 0 on the centreline, 1 at the ribbon's edge.
    float u    = abs(vSide);
    float halo = (1.0 - u) * (1.0 - u);
    float core = (1.0 - smoothstep(0.0, 0.32, u)) * vCore;
    vec3  col  = vColor * halo * 1.35 + vec3(1.0) * core;
    float a    = vAlpha * max(halo, core);
    if (uXrayPass > 0.5) a *= uXrayAlpha;
    if (a < 0.003) discard;
    gl_FragColor = vec4(col, a);
  }
`;

export function createStripGeometry(maxStrips) {
  const verts = maxStrips * VERTS_PER_STRIP;
  const geo = new THREE.BufferGeometry();
  const attr = (n, size) => {
    const a = new THREE.BufferAttribute(new Float32Array(n * size), size);
    a.setUsage(THREE.DynamicDrawUsage);
    return a;
  };
  geo.setAttribute('position', attr(verts, 3));
  geo.setAttribute('aTangent', attr(verts, 3));
  geo.setAttribute('aColor', attr(verts, 3));
  geo.setAttribute('aSide', new THREE.BufferAttribute(new Float32Array(verts), 1));
  geo.setAttribute('aWidth', attr(verts, 1));
  geo.setAttribute('aAlpha', attr(verts, 1));
  geo.setAttribute('aCore', attr(verts, 1));
  geo.setAttribute('aXray', attr(verts, 1));

  const side = geo.attributes.aSide.array;
  for (let v = 0; v < verts; v++) side[v] = v % 2 === 0 ? -1 : 1;

  const indices = new Uint32Array(maxStrips * INDICES_PER_STRIP);
  let w = 0;
  for (let s = 0; s < maxStrips; s++) {
    const base = s * VERTS_PER_STRIP;
    for (let i = 0; i < STRIP_POINTS - 1; i++) {
      const a = base + i * 2, b = a + 1, c = a + 2, d = a + 3;
      indices[w++] = a; indices[w++] = b; indices[w++] = c;
      indices[w++] = b; indices[w++] = d; indices[w++] = c;
    }
  }
  geo.setIndex(new THREE.BufferAttribute(indices, 1));
  geo.setDrawRange(0, 0);
  return geo;
}

/**
 * Two materials over the same geometry. The lit pass is depth-tested like any
 * surface effect. The x-ray pass ignores depth and draws only what a strip marks
 * as x-ray (the wormhole surges) at low alpha: a surge spends most of its trip
 * inside the cube, and without this the player would see it vanish into one tile
 * and reappear from another with nothing in between.
 */
export function createStripMaterials() {
  const make = (xray) => new THREE.ShaderMaterial({
    uniforms: { uXrayPass: { value: xray ? 1 : 0 }, uXrayAlpha: { value: 0.3 } },
    vertexShader,
    fragmentShader,
    transparent: true,
    depthWrite: false,
    depthTest: !xray,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    toneMapped: false
  });
  return { lit: make(false), xray: make(true) };
}

/**
 * Allocation-free writer over the strip pool.
 *
 *   w.begin()
 *   const s = w.open()             // -1 when the pool is full
 *   w.point(s, i, x, y, z, width, alpha, r, g, b, core, xray)
 *   w.close(s, pointCount)         // tangents + degenerate padding
 *   w.end()                        // draw range + upload
 */
export function createStripWriter(geo, maxStrips) {
  const pos = geo.attributes.position.array;
  const tan = geo.attributes.aTangent.array;
  const col = geo.attributes.aColor.array;
  const wid = geo.attributes.aWidth.array;
  const alp = geo.attributes.aAlpha.array;
  const cor = geo.attributes.aCore.array;
  const xr = geo.attributes.aXray.array;
  let used = 0;
  let lastUsed = 0;

  const writer = {
    get used() { return used; },
    begin() { used = 0; },
    open() { return used < maxStrips ? used++ : -1; },
    point(s, i, x, y, z, width, alpha, r, g, b, core, xray) {
      if (s < 0 || i < 0 || i >= STRIP_POINTS) return;
      const v = s * VERTS_PER_STRIP + i * 2;
      for (let k = 0; k < 2; k++) {
        const vi = v + k;
        const p = vi * 3;
        pos[p] = x; pos[p + 1] = y; pos[p + 2] = z;
        col[p] = r; col[p + 1] = g; col[p + 2] = b;
        wid[vi] = width;
        alp[vi] = alpha;
        cor[vi] = core;
        xr[vi] = xray;
      }
    },
    close(s, count) {
      if (s < 0) return;
      const n = Math.max(1, Math.min(STRIP_POINTS, count));
      const base = s * VERTS_PER_STRIP;
      for (let i = 0; i < n; i++) {
        const a = Math.max(0, i - 1);
        const b = Math.min(n - 1, i + 1);
        const pa = (base + a * 2) * 3;
        const pb = (base + b * 2) * 3;
        let tx = pos[pb] - pos[pa], ty = pos[pb + 1] - pos[pa + 1], tz = pos[pb + 2] - pos[pa + 2];
        const l = Math.hypot(tx, ty, tz);
        if (l > 1e-6) { tx /= l; ty /= l; tz /= l; } else { tx = 0; ty = 1; tz = 0; }
        for (let k = 0; k < 2; k++) {
          const p = (base + i * 2 + k) * 3;
          tan[p] = tx; tan[p + 1] = ty; tan[p + 2] = tz;
        }
      }
      // Pad the unused tail with zero-width copies of the last point: the quads
      // collapse to nothing and cost only their (trivial) vertex work.
      const lp = (base + (n - 1) * 2) * 3;
      for (let i = n; i < STRIP_POINTS; i++) {
        for (let k = 0; k < 2; k++) {
          const vi = base + i * 2 + k;
          const p = vi * 3;
          pos[p] = pos[lp]; pos[p + 1] = pos[lp + 1]; pos[p + 2] = pos[lp + 2];
          tan[p] = tan[lp]; tan[p + 1] = tan[lp + 1]; tan[p + 2] = tan[lp + 2];
          wid[vi] = 0;
          alp[vi] = 0;
        }
      }
    },
    end() {
      geo.setDrawRange(0, used * INDICES_PER_STRIP);
      // Upload while anything is drawn, and once more on the frame the storm goes
      // quiet so no stale strip lingers in the buffer.
      // Only the slots in use (or just vacated) are sent to the GPU.
      const span = Math.max(used, lastUsed) * VERTS_PER_STRIP;
      if (span > 0) {
        for (const name of DYNAMIC_ATTRS) {
          const a = geo.attributes[name];
          a.clearUpdateRanges();
          a.addUpdateRange(0, span * a.itemSize);
          a.needsUpdate = true;
        }
      }
      lastUsed = used;
    }
  };
  return writer;
}
