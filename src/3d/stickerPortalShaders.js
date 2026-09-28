// Shared shader sources for live portals and the mode's resident warm-up.
import * as THREE from 'three';

export const hazardCrackVertexShader = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

export const hazardCrackFragmentShader = `
  uniform vec3 uColor;
  uniform float uTime;
  uniform float uIntensity;
  varying vec2 vUv;

  float hash21(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
  }

  void main() {
    vec2 uv = vUv - 0.5;
    float dist = length(uv);
    if (dist > 0.5) discard;

    float radialMask = smoothstep(0.5, 0.18, dist);
    float angle = atan(uv.y, uv.x);
    float angleN = (angle + 3.14159265) / 6.2831853;

    float crackA = abs(fract(angleN * 7.0 + sin(dist * 20.0 + uTime * 2.1) * 0.06) - 0.5);
    float crackB = abs(fract(angleN * 11.0 + cos(dist * 26.0 - uTime * 2.7) * 0.08) - 0.5);
    float crackLines = (1.0 - smoothstep(0.0, 0.05, crackA)) + (1.0 - smoothstep(0.0, 0.04, crackB));

    float ringCrack = 1.0 - smoothstep(0.0, 0.035, abs(dist - (0.25 + sin(angle * 3.0 + uTime * 3.0) * 0.02)));
    float shards = smoothstep(0.78, 1.0, hash21(floor((uv + 0.5) * 18.0) + uTime * 0.02));

    float crackMask = clamp(crackLines * 0.45 + ringCrack * 0.6 + shards * 0.25, 0.0, 1.0);
    float pulse = 0.65 + sin(uTime * 8.0 + angle * 5.0) * 0.35;
    float alpha = crackMask * radialMask * pulse * uIntensity;

    gl_FragColor = vec4(uColor * 1.9, alpha);
  }
`;

export const seamLeakFragmentShader = `
  uniform vec3 uColor;
  uniform float uTime;
  uniform float uIntensity;
  varying vec2 vUv;

  void main() {
    vec2 uv = vUv;
    float edge = max(abs(uv.x - 0.5), abs(uv.y - 0.5));

    // Brightness concentrated near the tile perimeter (where dark seams live).
    float edgeBand = smoothstep(0.38, 0.5, edge);
    // Suppress center so light does not appear to emit through the middle of the tile.
    float centerBlock = 1.0 - smoothstep(0.18, 0.28, length(uv - 0.5));
    float seamMask = edgeBand * (1.0 - centerBlock);

    float waveX = sin((uv.x * 18.0 + uTime * 4.0));
    float waveY = cos((uv.y * 22.0 - uTime * 3.2));
    float pulse = 0.55 + (waveX * waveY) * 0.25 + sin(uTime * 7.5) * 0.2;

    float alpha = clamp(seamMask * pulse * uIntensity, 0.0, 1.0);
    gl_FragColor = vec4(uColor * 1.7, alpha);
  }
`;

// ─── Worm-mode rim glow shader ────────────────────────────────────────────────
// Heartbeat ring on the outer rim of flipped tiles — only active in worm healer
// mode. Annular band from ~UV 0.30 to 0.50 on the 1.05×1.05 rim plane, so the
// glow overlaps the tile edge and extends ~0.1 world-units beyond it.
export const wormRimGlowFragmentShader = `
  uniform vec3  uColor;
  uniform float uTime;
  uniform float uIntensity;
  varying vec2  vUv;

  void main() {
    vec2  p    = vUv - 0.5;
    float dist = length(p);
    if (dist > 0.5) discard;

    // Annular band covering the outer rim of the tile and slightly beyond its edge.
    float rim = smoothstep(0.30, 0.39, dist) * (1.0 - smoothstep(0.44, 0.50, dist));

    // Heartbeat: sharp 12 % attack, slow exponential decay over the remaining 88 %.
    float t    = fract(uTime * 1.8);
    float beat = t < 0.12 ? t / 0.12 : pow(1.0 - (t - 0.12) / 0.88, 2.5);

    // Rotating shimmer so the ring sparkles from every camera angle.
    float angle   = atan(p.y, p.x);
    float shimmer = 0.60 + 0.40 * sin(angle * 6.0 + uTime * 5.0);

    float alpha = rim * (0.55 + beat * 0.75) * shimmer * uIntensity;
    gl_FragColor = vec4(uColor * (1.5 + beat * 2.0), alpha);
  }
`;

// A single, dominant depth cue for worm-mode flipped tiles. Concentric rounded
// squares contract toward an off-centre vanishing point while sparse spokes
// breathe outward. Unlike the older crack/rim decoration this reads as an actual
// opening even in a still frame and leaves a border of the tile colour visible.
export const wormApertureFragmentShader = `
  uniform vec3 uColor;
  uniform float uTime;
  uniform float uIntensity;
  uniform float uDanger;
  varying vec2 vUv;

  void main() {
    vec2 p = vUv - 0.5;
    float box = max(abs(p.x), abs(p.y));
    float opening = 1.0 - smoothstep(0.39, 0.49, box);

    vec2 q = p + vec2(sin(uTime * 0.37), cos(uTime * 0.31)) * 0.018;
    float depth = max(abs(q.x), abs(q.y));
    float rings = pow(1.0 - abs(fract(depth * 13.0 - uTime * (0.34 + uDanger * 0.22)) - 0.5) * 2.0, 7.0);
    float angle = atan(q.y, q.x);
    float rays = pow(max(0.0, sin(angle * 6.0 + uTime * 0.55)), 18.0)
      * smoothstep(0.08, 0.42, depth) * (1.0 - smoothstep(0.42, 0.49, depth));
    float throat = 1.0 - smoothstep(0.02, 0.18, length(q));
    float rim = smoothstep(0.35, 0.43, box) * (1.0 - smoothstep(0.43, 0.49, box));
    float beat = 0.72 + 0.28 * sin(uTime * (2.2 + uDanger * 2.0));

    vec3 voidCol = vec3(0.006, 0.008, 0.018);
    vec3 col = voidCol + uColor * (rings * 0.48 + rays * 0.9 + rim * 1.25) * beat;
    col += uColor * throat * 0.13;
    float alpha = opening * uIntensity * (0.88 + rim * 0.12);
    gl_FragColor = vec4(col, alpha);
  }
`;

// Persistent spinning-wispy-ring shader — replaces static color rings on every tile.
// Reuses the same spinning-arc formula as spinRevealFragmentShader but at a fixed
// ring radius so it animates continuously rather than during a flip.
export const wispyRingVertexShader = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

export const wispyRingFragmentShader = `
  uniform vec3 uColor;      // face color (strand A)
  uniform vec3 uAntiColor;  // antipodal face color (strand B)
  uniform float uTime;
  uniform float uLens; // 0 = normal tile, 1 = wormhole — enables subtle gravitational barrel distortion
  uniform float uFlipRatio; // 0..1 = flips / flipCap — the closer to death, the hotter + faster the ring
  varying vec2 vUv;

  void main() {
    vec2 uv = vUv - 0.5;

    // Gravitational lens: very slight barrel distortion on wormhole tiles.
    if (uLens > 0.5) {
      float d2 = dot(uv, uv);
      uv = uv * (1.0 - 0.11 * d2);
    }

    float dist = length(uv);
    float angle = atan(uv.y, uv.x);

    // Clip to tile disc boundary
    float inDisc = 1.0 - smoothstep(0.44, 0.50, dist);

    // Heartbeat pulse — speeds up as the tile accumulates flips so a near-dead
    // tile visibly throbs with urgency. uFlipRatio 0 → calm, 1 → frantic.
    float pulseHz = 1.4 + uFlipRatio * 6.0;
    float pulse   = 0.5 + 0.5 * sin(uTime * pulseHz); // 0..1

    // Double-helix: two thin strands braiding around r0.
    // Each strand weaves in/out of the base radius using a sinusoidal offset;
    // strand B is exactly half a period (PI) behind strand A so they always
    // sit on opposite sides of the ring — the classic double-helix relationship.
    float r0        = 0.36;   // base ring radius
    float weave     = 0.030;  // radial weave amplitude (thinner = smaller)
    float turns     = 4.0;    // helix turns around the ring (integer → seamless loop)
    float speed     = 1.6 + uFlipRatio * 2.6; // spins faster as it nears the cap
    float phase     = angle * turns - uTime * speed;

    float rA = r0 + weave * sin(phase);
    float rB = r0 + weave * sin(phase + 3.14159265);

    // Gaussian radial falloff — controls strand thickness (smaller sigma = thinner)
    float sigma = 0.013;
    float gA = exp(-pow(dist - rA, 2.0) / (2.0 * sigma * sigma));
    float gB = exp(-pow(dist - rB, 2.0) / (2.0 * sigma * sigma));

    // Soft sparkle: brightness pulses at twice the helix frequency for a live feel
    gA *= 0.75 + 0.25 * sin(phase * 2.0);
    gB *= 0.75 + 0.25 * sin(phase * 2.0 + 3.14159265);

    gA *= inDisc;
    gB *= inDisc;

    // Blend the two strand colors; where they overlap use a weighted average
    float total = gA + gB;
    vec3 strandCol = total > 0.001 ? (uColor * gA + uAntiColor * gB) / total : uColor;

    // Antipodal glow halo — a broad, soft band in the antipodal color sitting
    // under the crisp strands. Makes the ring read as a distinct colored glow at
    // a glance; it brightens with flip count and breathes with the heartbeat.
    float glowSigma = 0.058;
    float glow      = exp(-pow(dist - r0, 2.0) / (2.0 * glowSigma * glowSigma)) * inDisc;
    float glowAmp   = (0.18 + 0.62 * uFlipRatio) * (0.55 + 0.45 * pulse);
    float glowI     = glow * glowAmp;

    // Compose strands + antipodal glow, weighting color by each contribution.
    float sumI = total + glowI;
    vec3 col = sumI > 0.001 ? (strandCol * total + uAntiColor * glowI) / sumI : uColor;

    float alpha = clamp(sumI, 0.0, 1.0) * 0.92;
    // Whole ring breathes brighter on each beat (stronger pulse near death).
    float breathe = 1.0 + (0.12 + 0.28 * uFlipRatio) * (pulse - 0.5) * 2.0;
    gl_FragColor = vec4(col * 1.3 * breathe, alpha);
  }
`;

// ─── Neon worm-border shader ──────────────────────────────────────────────────
// Replaces the old solid parity ring. Lights up the SQUARE outer edge of the tile
// like the neon view mode, then sends a handful of bright "light-worms" chasing one
// another around the perimeter. Each worm is a white-hot head with a trailing comet
// tail; they wiggle as they slither and speed up as the tile's flip count climbs
// toward its cap (uFlipRatio), so a strained tile's border races frantically.
export const neonBorderVertexShader = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

export const neonBorderFragmentShader = `
  uniform vec3  uColor;      // antipodal ("other side") color of the displaced tile
  uniform float uTime;       // shared wispyTime — advances every frame
  uniform float uFlipRatio;  // flips / cap → worms race faster & burn hotter near death
  varying vec2  vUv;

  #define TAU 6.28318530718

  void main() {
    vec2 p = vUv - 0.5;              // -0.5 .. 0.5
    vec2 a = abs(p);
    float m = max(a.x, a.y);
    float edgeDist = 0.5 - m;        // 0 at the square edge, grows inward
    if (edgeDist > 0.16) discard;    // only the border band is ever lit

    // Perimeter coordinate s ∈ [0,1) running clockwise around the square.
    float s;
    if (p.y >= a.x)       s = (p.x + 0.5) * 0.25;          // top    L→R  0.00–0.25
    else if (p.x >= a.y)  s = 0.25 + (0.5 - p.y) * 0.25;   // right  T→B  0.25–0.50
    else if (-p.y >= a.x) s = 0.50 + (0.5 - p.x) * 0.25;   // bottom R→L  0.50–0.75
    else                  s = 0.75 + (p.y + 0.5) * 0.25;   // left   B→T  0.75–1.00

    // Band hugging the edge; its thickness wiggles along its length + over time so
    // the tube looks alive rather than a static rectangle.
    float wig = 1.0 + 0.35 * sin(s * TAU * 6.0 - uTime * 5.0);
    float bw  = 0.052 * wig;
    float band = 1.0 - smoothstep(0.0, bw, edgeDist);

    // Dim continuous neon tube around the whole square.
    float baseGlow = band * 0.28;

    // Chasing light-worms: bright heads + comet tails racing around the loop. Each
    // worm runs a touch faster than the one ahead so they visibly chase and bunch;
    // the whole pack accelerates with flip count.
    const int N = 3;
    float speed   = 0.09 + uFlipRatio * 0.60;  // laps / sec: calm → frantic
    float headLen = 0.045;
    float tailLen = 0.10;
    float worms = 0.0;
    for (int i = 0; i < N; i++) {
      float fi = float(i);
      float sp = speed * (1.0 + fi * 0.10);                 // faster ⇒ catches the next
      float head = fract(fi / float(N) + uTime * sp);
      head = fract(head + 0.006 * sin(uTime * 9.0 + fi * 2.0)); // slither wiggle
      float sd = fract(s - head + 0.5) - 0.5;               // signed wrap distance
      float h = exp(-(sd * sd) / (headLen * headLen));      // glowing head
      float tail = sd < 0.0 ? exp(sd / tailLen) * 0.55 : 0.0; // comet tail behind it
      worms += max(h, tail);
    }
    worms = clamp(worms, 0.0, 1.4) * band;

    float glow = baseGlow + worms;
    // Colored tube, white-hot at the worm heads. Hotter overall as the tile nears death.
    vec3 col = uColor * (0.9 + 0.7 * uFlipRatio);
    col = mix(col, vec3(1.0), clamp(worms - 0.45, 0.0, 1.0) * 0.7);

    float alpha = clamp(glow, 0.0, 1.0);
    if (alpha < 0.004) discard;
    gl_FragColor = vec4(col * 1.6, alpha);
  }
`;

// ─── Eyelid blink overlay ─────────────────────────────────────────────────────
// Fires on disparity (odd-flip) transitions.
// The FROM-color mesh stays fully visible underneath; this overlay covers the full
// tile disc with the TO color at ~0.5 alpha (NormalBlending), so both colors are
// simultaneously visible — the quantum superposition / 50-50 blend moment.
// The scale.y eyelid squish and the lid-edge gleam ride on top of that blend.
export const eyelidVertexShader = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

export const eyelidFragmentShader = `
  uniform vec3  uColorTo;  // current visible face color in Chaos
  uniform float uClean;    // Chaos: edge gleam only, no full-face color blending
  uniform float uProgress; // 1 = fully open, 0 = fully closed (= flipSquish)
  uniform float uTime;
  varying vec2 vUv;

  void main() {
    vec2 uv = vUv - 0.5;
    float dist = length(uv);
    float inDisc = 1.0 - smoothstep(0.43, 0.50, dist);
    float closed  = 1.0 - uProgress;  // 1 when squished shut, 0 when open

    // Full-disc base at 0.5 alpha: overlaid on the FROM-color mesh via NormalBlending
    // this gives exactly a 50/50 mix — both states visible simultaneously.
    float baseAlpha = 0.50 * inDisc * (1.0 - uClean);

    // Eyelid edge gleam — bright band at top and bottom rim, intensifies as lids close.
    float topBot  = abs(abs(uv.y) - 0.41);
    float lidEdge = (1.0 - smoothstep(0.0, 0.055, topBot)) * inDisc;
    float lidBright = 0.15 + closed * 0.85;
    float shimmer = (0.5 + 0.5 * sin(atan(uv.x, uv.y) * 8.0 - uTime * 6.0))
                    * lidEdge * 0.30;

    // Center pinpoint: flares at the superposition peak (scale.y ≈ 0).
    float core = (1.0 - smoothstep(0.0, 0.09, dist)) * closed * closed;

    // Iris ring sweeps outward from center as the eye opens (phase 2).
    float irisR = uProgress * 0.44;
    float iris  = (1.0 - smoothstep(0.0, 0.045, abs(dist - irisR))) * uProgress * inDisc;

    float alpha = clamp(baseAlpha + lidEdge * lidBright + (core * 1.1 + iris * 0.55) * (1.0 - uClean) + shimmer,
                        0.0, 0.95);

    if (alpha < 0.001) discard;
    gl_FragColor = vec4(uColorTo, alpha);
  }
`;

// Spin-reveal overlay: new tile face sweeps in from the outer rim toward the center
// with a spinning arc glow at the leading edge. Used to replace the midpoint white flash.
export const spinRevealVertexShader = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

// Flip overlay shader: additive rim glow at the tile edge during the flip. Transparent in
// the center so living/patterned tile styles show through — only the outer ring carries the
// flip energy color. Uses AdditiveBlending so it brightens whatever is underneath rather
// than covering it, which prevents a flat-color "flash" on textured or 3D-styled tiles.
export const spinRevealFragmentShader = `
  uniform vec3 uColor;
  uniform float uProgress; // 1 = calm, 0 = peak transition energy
  uniform float uTime;
  uniform float uDissolve; // flipSquish: 1=face-on (bright), 0=edge-on (dim)
  varying vec2 vUv;

  void main() {
    vec2 uv = vUv - 0.5;
    float dist = length(uv);
    float angle = atan(uv.y, uv.x);

    float inDisc = 1.0 - smoothstep(0.44, 0.50, dist);
    float energy = 1.0 - uProgress;

    // Rim band — only covers the outer ring of the tile so the center is transparent.
    float rim = smoothstep(0.30, 0.43, dist) * (1.0 - smoothstep(0.44, 0.50, dist));

    // Rotating wisps confined to the rim band.
    float swirl = 0.5 + 0.5 * sin(angle * 10.0 - uTime * 7.0 + dist * 20.0);
    float wisp = rim * swirl * energy;

    // Edge-lighting: tile dims as it rotates edge-on (uDissolve tracks squish).
    float brightness = 0.5 + 0.65 * uDissolve;
    vec3 col = uColor * brightness * (1.0 + wisp * 0.5);

    // Alpha: rim only — center stays at 0 so living/patterned content shows through.
    float alpha = inDisc * clamp(rim * (0.7 + energy * 0.5) + wisp * 0.4, 0.0, 1.0);
    gl_FragColor = vec4(col, alpha);
  }
`;

export const spiderVertexShader = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

export const spiderFragmentShader = `
  uniform vec3  uColor;
  uniform float uTime;
  uniform float uBurst;
  varying vec2  vUv;

  void main() {
    // Square portal frame — glowing border, transparent center shows the tunnel within
    float bw        = 0.09;
    float leftEdge  = 1.0 - smoothstep(0.0, bw, vUv.x);
    float rightEdge = smoothstep(1.0 - bw, 1.0, vUv.x);
    float botEdge   = 1.0 - smoothstep(0.0, bw, vUv.y);
    float topEdge   = smoothstep(1.0 - bw, 1.0, vUv.y);
    float border    = clamp(leftEdge + rightEdge + botEdge + topEdge, 0.0, 1.0);
    if (border < 0.01) discard;

    // Gentle energy pulse rippling around the portal edge
    float wave  = sin(uTime * 2.5 + (vUv.x + vUv.y) * 12.57) * 0.5 + 0.5;
    float pulse = 0.65 + wave * 0.35;
    gl_FragColor = vec4(uColor * 1.8 * pulse, border * uBurst);
  }
`;

export function createStickerPortalWarmupMaterials() {
  const additive = { transparent: true, depthWrite: false, blending: THREE.AdditiveBlending };
  return [
    new THREE.ShaderMaterial({ transparent: true, depthWrite: false, vertexShader: spiderVertexShader, fragmentShader: spiderFragmentShader }),
    new THREE.ShaderMaterial({ ...additive, vertexShader: neonBorderVertexShader, fragmentShader: neonBorderFragmentShader }),
    new THREE.ShaderMaterial({ ...additive, vertexShader: spinRevealVertexShader, fragmentShader: spinRevealFragmentShader }),
    new THREE.ShaderMaterial({ transparent: true, depthWrite: false, vertexShader: eyelidVertexShader, fragmentShader: eyelidFragmentShader }),
    new THREE.ShaderMaterial({ ...additive, vertexShader: wispyRingVertexShader, fragmentShader: wispyRingFragmentShader }),
    new THREE.ShaderMaterial({ ...additive, vertexShader: hazardCrackVertexShader, fragmentShader: hazardCrackFragmentShader }),
    new THREE.ShaderMaterial({ ...additive, vertexShader: hazardCrackVertexShader, fragmentShader: seamLeakFragmentShader, side: THREE.DoubleSide }),
    new THREE.ShaderMaterial({ transparent: true, depthWrite: false, vertexShader: hazardCrackVertexShader, fragmentShader: wormApertureFragmentShader }),
    new THREE.ShaderMaterial({ ...additive, vertexShader: hazardCrackVertexShader, fragmentShader: wormRimGlowFragmentShader }),
  ];
}
