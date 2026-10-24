import * as THREE from 'three';

// The heal's two tile effects, one shared material each for every tile (each tile
// binds its own values just before its draw, sharedEffectMaterials.js). Exported
// for the run's warm-up: a resting WORM tile mounts neither (tileFrames.js), so the
// live scene no longer holds their programs until the first heal.

// ─── Heal seal shader ─────────────────────────────────────────────────────────
// Plays when the worm heals a wormhole tile.
// Phase 1 (uHealProgress 0→0.5): golden ring converges rim→center (wound closing).
// Phase 2 (uHealProgress 0.5→1): the home colour rings back out from the centre.
const healSealVertexShader = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const healSealFragmentShader = `
  uniform vec3  uColor;        // original (healed) face color
  uniform float uHealProgress; // 0→1
  uniform float uTime;
  varying vec2 vUv;

  void main() {
    vec2 uv = vUv - 0.5;
    float dist = length(uv);
    float inDisc = 1.0 - smoothstep(0.44, 0.50, dist);

    vec4 col = vec4(0.0);

    if (uHealProgress < 0.5) {
      // Phase 1: golden convergence ring rushes from rim to center
      float t = uHealProgress * 2.0;
      // Quadratic contraction — fast start, slows to a stop at the center
      float ringR = 0.44 * (1.0 - t * t);
      float ringWidth = 0.036 + 0.018 * (1.0 - t);
      float ring = 1.0 - smoothstep(0.0, ringWidth, abs(dist - ringR));
      // Color sweeps gold → pure white as the ring closes
      vec3 goldColor = vec3(1.0, 0.87, 0.20);
      vec3 ringCol = mix(goldColor, vec3(1.0, 1.0, 1.0), t * 0.70);
      float ringAlpha = ring * inDisc * (0.80 + 0.20 * t);
      // Soft trailing wake just behind the ring (slightly wider, dimmer)
      float wake = 1.0 - smoothstep(0.0, 0.04, abs(dist - (ringR + 0.07)));
      float wakeAlpha = wake * inDisc * 0.25 * (1.0 - t);
      col = vec4(ringCol * 1.8, max(ringAlpha, wakeAlpha));
    } else {
      // Phase 2: the tile's home colour rings out from the centre. Two thin rings and
      // a small glint, never a disc: a heal is a flip home, and a flip never washes
      // the tile (the sticker itself has already turned back to its home colour).
      float t = (uHealProgress - 0.5) * 2.0;
      float e = 1.0 - (1.0 - t) * (1.0 - t);
      float r1 = 0.04 + e * 0.42;
      float r2 = 0.04 + max(0.0, e - 0.25) / 0.75 * 0.34;
      float ring1 = 1.0 - smoothstep(0.0, 0.03, abs(dist - r1));
      float ring2 = (1.0 - smoothstep(0.0, 0.02, abs(dist - r2))) * step(0.25, e);
      float fade = 1.0 - t;
      float glint = (1.0 - smoothstep(0.0, 0.1, dist)) * fade * fade;
      float ringAlpha = (ring1 * 0.95 + ring2 * 0.6) * fade * inDisc;
      vec3 ringCol = mix(uColor, vec3(1.0), 0.25) * 1.6;
      col = vec4(mix(ringCol, vec3(1.8), glint), max(ringAlpha, glint * 0.9));
    }

    if (col.a < 0.001) discard;
    gl_FragColor = col;
  }
`;

export const healSealMaterial = new THREE.ShaderMaterial({
  vertexShader: healSealVertexShader, fragmentShader: healSealFragmentShader,
  uniforms: { uColor: { value: new THREE.Color() }, uHealProgress: { value: 0 }, uTime: { value: 0 } },
  transparent: true, depthTest: true, depthWrite: false, blending: THREE.AdditiveBlending
});

// One InstancedMesh: each sparkle is placed by its own instance matrix, or every
// one draws as the full plane over the tile (see particleVertex in flipBurstShaders.js).
const sparkVertexShader = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    vec4 local = vec4(position, 1.0);
    #ifdef USE_INSTANCING
      local = instanceMatrix * local;
    #endif
    gl_Position = projectionMatrix * modelViewMatrix * local;
  }
`;

const sparkFragmentShader = `
  uniform vec3  uColor;
  uniform float uOpacity;
  varying vec2  vUv;

  void main() {
    vec2 p = (vUv - 0.5) * 2.0;

    // Rounded-square SDF — same shape as FlipParticles chips
    float corner = 0.28;
    vec2  q = abs(p) - (1.0 - corner);
    float dist = length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - corner;
    float chipAlpha = 1.0 - smoothstep(-0.05, 0.12, dist);

    // Warm inner highlight — brighter than FlipParticles to emphasise the gold
    float highlight = 1.0 - smoothstep(0.0, 0.50, length(p));
    vec3 litColor = uColor + highlight * 0.70;

    // Crisp border
    float border = 1.0 - smoothstep(0.82, 0.98, max(abs(p.x), abs(p.y)));
    litColor += border * 0.35;

    gl_FragColor = vec4(clamp(litColor, 0.0, 1.0), chipAlpha * uOpacity);
  }
`;

// One material for every tile's sparks; each binds its own colour and fade just
// before its draw (sharedEffectMaterials.js).
export const healParticleMaterial = new THREE.ShaderMaterial({
  uniforms: { uColor: { value: new THREE.Color() }, uOpacity: { value: 0 } },
  vertexShader: sparkVertexShader,
  fragmentShader: sparkFragmentShader,
  transparent: true,
  side: THREE.DoubleSide,
  depthWrite: false,
  blending: THREE.AdditiveBlending,
});
