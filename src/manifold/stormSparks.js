// src/manifold/stormSparks.js
//
// Impact sparks for the chaos storm: one THREE.Points pool, recycled round-robin,
// stepped on the CPU (a couple of hundred particles is nothing) and drawn in one
// call. Sparks fly off along the struck tile's normal, drag, and fall under a
// light gravity, which is what sells a strike as physical rather than a decal.
//
// The same pool carries the impact flash — one big, very short-lived particle —
// so a landing costs no extra meshes.

import * as THREE from 'three';

const vertexShader = `
  attribute vec3  aColor;
  attribute float aSize;
  attribute float aAlpha;
  uniform float uScale;
  varying vec3  vColor;
  varying float vAlpha;
  void main() {
    vColor = aColor;
    vAlpha = aAlpha;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    // aSize is a world-space diameter; uScale converts it to pixels at depth 1.
    gl_PointSize = min(128.0, aSize * uScale / max(0.05, -mv.z));
    gl_Position = projectionMatrix * mv;
  }
`;

const fragmentShader = `
  varying vec3  vColor;
  varying float vAlpha;
  void main() {
    float d = length(gl_PointCoord - 0.5) * 2.0;
    if (d > 1.0 || vAlpha < 0.003) discard;
    float halo = (1.0 - d) * (1.0 - d);
    float core = 1.0 - smoothstep(0.0, 0.38, d);
    vec3  col  = vColor * halo * 1.3 + vec3(1.0) * core;
    gl_FragColor = vec4(col, vAlpha * max(halo, core));
  }
`;

export function createSparkPool(max) {
  const geo = new THREE.BufferGeometry();
  const dyn = (n, size) => {
    const a = new THREE.BufferAttribute(new Float32Array(n * size), size);
    a.setUsage(THREE.DynamicDrawUsage);
    return a;
  };
  geo.setAttribute('position', dyn(max, 3));
  geo.setAttribute('aColor', dyn(max, 3));
  geo.setAttribute('aSize', dyn(max, 1));
  geo.setAttribute('aAlpha', dyn(max, 1));
  // Positions are world space in a mesh at the origin; the lazily computed
  // bounding sphere would be meaningless, so the Points object disables culling.
  return {
    geo,
    max,
    pos: geo.attributes.position.array,
    col: geo.attributes.aColor.array,
    size: geo.attributes.aSize.array,
    alpha: geo.attributes.aAlpha.array,
    vel: new Float32Array(max * 3),
    life: new Float32Array(max),
    maxLife: new Float32Array(max),
    size0: new Float32Array(max),
    drag: new Float32Array(max),
    grav: new Float32Array(max),
    next: 0,
    live: 0,
    wasLive: 0
  };
}

export function createSparkMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: { uScale: { value: 600 } },
    vertexShader,
    fragmentShader,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    toneMapped: false
  });
}

/** Recycle the oldest slot for a new spark. */
export function spawnSpark(pool, x, y, z, vx, vy, vz, life, size, r, g, b, { drag = 3.2, gravity = 5.5 } = {}) {
  const i = pool.next;
  pool.next = (pool.next + 1) % pool.max;
  const p = i * 3;
  pool.pos[p] = x; pool.pos[p + 1] = y; pool.pos[p + 2] = z;
  pool.vel[p] = vx; pool.vel[p + 1] = vy; pool.vel[p + 2] = vz;
  pool.col[p] = r; pool.col[p + 1] = g; pool.col[p + 2] = b;
  pool.life[i] = life;
  pool.maxLife[i] = life;
  pool.size0[i] = size;
  pool.size[i] = size;
  pool.alpha[i] = 1;
  pool.drag[i] = drag;
  pool.grav[i] = gravity;
}

/** Advance every live spark by `dt` seconds. Returns how many are still alive. */
export function stepSparks(pool, dt) {
  let live = 0;
  for (let i = 0; i < pool.max; i++) {
    if (pool.life[i] <= 0) continue;
    pool.life[i] -= dt;
    if (pool.life[i] <= 0) {
      pool.life[i] = 0;
      pool.alpha[i] = 0;
      pool.size[i] = 0;
      continue;
    }
    live++;
    const p = i * 3;
    const damp = Math.max(0, 1 - pool.drag[i] * dt);
    pool.vel[p] *= damp;
    pool.vel[p + 1] = pool.vel[p + 1] * damp - pool.grav[i] * dt;
    pool.vel[p + 2] *= damp;
    pool.pos[p] += pool.vel[p] * dt;
    pool.pos[p + 1] += pool.vel[p + 1] * dt;
    pool.pos[p + 2] += pool.vel[p + 2] * dt;
    const k = pool.life[i] / pool.maxLife[i];
    pool.alpha[i] = Math.pow(k, 0.7);
    pool.size[i] = pool.size0[i] * (0.35 + 0.65 * k);
  }
  if (live > 0 || pool.wasLive > 0) {
    pool.geo.attributes.position.needsUpdate = true;
    pool.geo.attributes.aColor.needsUpdate = true;
    pool.geo.attributes.aSize.needsUpdate = true;
    pool.geo.attributes.aAlpha.needsUpdate = true;
  }
  pool.wasLive = live;
  pool.live = live;
  return live;
}

export function clearSparks(pool) {
  pool.life.fill(0);
  pool.alpha.fill(0);
  pool.size.fill(0);
  pool.wasLive = 1; // one more upload so the cleared state reaches the GPU
}
