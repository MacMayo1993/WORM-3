/**
 * RP2GridBackground
 *
 * Renders the RP2 fundamental domain as an animated "graph paper" plane:
 *  - Center region: perfectly flat grid, clean blue-white lines
 *  - Edges: vertices displaced in Z via multi-octave noise — the paper
 *    physically crumples because flat RP2 identification can't stay flat
 *    when you try to realize the edge gluing in 3D space.
 *
 * Edge-identification arrows draw small chevrons along each edge pair
 * showing the antipodal twist: opposite edges match with a 180° rotation.
 */
import { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

// ─── Geometry constants ────────────────────────────────────────────────────
const PLANE_W = 40;
const PLANE_H = 24;
const SEG_X = 80;
const SEG_Y = 48;

// ─── Shaders ──────────────────────────────────────────────────────────────
const vertexShader = /* glsl */ `
  uniform float uTime;
  varying vec2  vUv;
  varying float vEdge;
  varying float vDispZ;

  void main() {
    vUv = uv;

    // Normalised coords in [-1, 1] from centre
    vec2 nc = uv * 2.0 - 1.0;

    // Edge factor: 0 in the flat centre, ramps to 1 at the boundary.
    // Flat zone covers the inner 45 %; crumple ramps over the outer 55 %.
    vec2  ed   = clamp((abs(nc) - 0.45) / 0.55, 0.0, 1.0);
    float edge = pow(max(ed.x, ed.y), 1.9);
    vEdge = edge;

    // Multi-octave noise — each octave adds finer wrinkles
    float px = position.x;
    float py = position.y;
    float t  = uTime;

    float n0 = sin(px * 0.55 + t * 0.19) * cos(py * 0.63 - t * 0.14);
    float n1 = sin(px * 1.30 - t * 0.11) * cos(py * 1.51 + t * 0.08);
    float n2 = sin(px * 2.90 + t * 0.07) * cos(py * 2.70 - t * 0.05);
    float n3 = sin(px * 6.10 - t * 0.04) * cos(py * 5.80 + t * 0.03);
    float noise = n0 * 0.50 + n1 * 0.28 + n2 * 0.14 + n3 * 0.06;

    // Extra fold at extreme corners — sharp pinch inward
    float corner = pow(ed.x * ed.y, 0.8) * 1.4;
    float disp = (noise * 3.0 + corner * sign(noise) * 1.8) * edge;
    vDispZ = disp;

    vec3 pos = position;
    pos.z += disp;

    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
  }
`;

const fragmentShader = /* glsl */ `
  uniform float uGridN;   // cells across the full UV [0,1]
  uniform float uMinW;    // minor-line half-width as fraction of one cell
  uniform float uMajW;    // major-line half-width as fraction of one major cell
  uniform float uAlpha;   // master opacity

  varying vec2  vUv;
  varying float vEdge;
  varying float vDispZ;

  void main() {
    // ── Minor grid lines ───────────────────────────────────────────────────
    vec2  gUV = fract(vUv * uGridN);
    float mx  = step(gUV.x, uMinW) + step(1.0 - uMinW, gUV.x);
    float my  = step(gUV.y, uMinW) + step(1.0 - uMinW, gUV.y);
    float minor = clamp(mx + my, 0.0, 1.0);

    // ── Major grid lines (every 5 cells) ──────────────────────────────────
    vec2  g5  = fract(vUv * uGridN / 5.0);
    float Mx  = step(g5.x, uMajW) + step(1.0 - uMajW, g5.x);
    float My  = step(g5.y, uMajW) + step(1.0 - uMajW, g5.y);
    float major = clamp(Mx + My, 0.0, 1.0);

    // Combine: major lines override minor
    float lineStr = max(minor * 0.55, major);
    // NOTE: no discard here — non-line pixels render as the paper background

    // ── Color ──────────────────────────────────────────────────────────────
    // Classic graph paper: blue lines on white paper.
    // Flat centre: crisp "Ampad" ruled-paper blue.
    // Crumpled edges: lines warm toward indigo as the paper folds under
    // the strain of RP2 identification; the paper background yellows slightly
    // like stress-creased graph stock.
    vec3 lineCol  = mix(vec3(0.22, 0.50, 0.88), vec3(0.35, 0.18, 0.72), vEdge);

    // Subtle extra brightness where the displacement is steepest
    float crumpleGlow = clamp(abs(vDispZ) * 0.12, 0.0, 0.28);
    lineCol += crumpleGlow * vec3(0.10, 0.05, 0.30);

    // Paper background — white with a faint warm tint at the crumpled edges
    vec3 paperCol = mix(vec3(0.96, 0.97, 1.00), vec3(0.94, 0.91, 0.82), vEdge * 0.7);

    // ── Alpha ──────────────────────────────────────────────────────────────
    // Paper needs to be near-opaque at centre to read as white against the
    // dark (#05050f) background — 22% opacity = ~20% brightness = dark grey.
    // Depth test keeps the cube punching through (plane is at z=-5).
    float paperAlpha = clamp(0.88 - vEdge * 0.52, 0.0, 1.0) * uAlpha;
    float lineAlpha  = clamp(0.95 - vEdge * 0.30, 0.0, 1.0) * uAlpha;

    // Blend paper under lines
    vec3  col   = mix(paperCol, lineCol, lineStr);
    float alpha = mix(paperAlpha, lineAlpha, lineStr);

    gl_FragColor = vec4(col, alpha);
  }
`;

// ─── Edge identification arrows ───────────────────────────────────────────
// Draw small chevrons along the 4 edges of the fundamental domain to
// show the antipodal RP2 gluing: left↑ ↔ right↓,  top→ ↔ bottom←
function buildArrowGeometry(planeW, planeH) {
  const positions = [];
  const colors    = [];

  const hw = planeW / 2;
  const hh = planeH / 2;

  // Number of chevron pairs along each edge
  const N = 5;
  // Chevron half-size
  const cs = 0.45;
  // How far inward from the plane edge the arrow sits (world units)
  const inset = 0.55;

  const colLeft   = new THREE.Color('#3b82f6'); // blue  (left  → up)
  const colRight  = new THREE.Color('#22c55e'); // green (right → down) — antipodal to blue
  const colTop    = new THREE.Color('#eeeeee'); // white (top   → right)
  const colBot    = new THREE.Color('#eab308'); // yellow(bot   → left)  — antipodal to white

  function addChevron(x, y, dx, dy, col) {
    // A simple "<" shape oriented along (dx,dy)
    // Perpendicular direction
    const px = -dy, py = dx;
    const tip = [x + dx * cs, y + dy * cs, 0];
    const b1  = [x - dx * cs + px * cs, y - dy * cs + py * cs, 0];
    const b2  = [x - dx * cs - px * cs, y - dy * cs - py * cs, 0];

    positions.push(...tip, ...b1);
    positions.push(...tip, ...b2);

    for (let i = 0; i < 4; i++) {
      colors.push(col.r, col.g, col.b);
    }
  }

  for (let i = 0; i < N; i++) {
    const t = (i + 0.5) / N; // 0..1 along edge

    // Left edge  (x = -hw): arrows point UP (0,+1)
    // Mapped antipodal position on right edge is flipped: (right, 1-t)
    addChevron(-hw + inset,  hh - t * planeH,   0,  1, colLeft);

    // Right edge (x = +hw): arrows point DOWN (0,-1)  ← antipodal twist
    addChevron( hw - inset,  hh - (1 - t) * planeH, 0, -1, colRight);

    // Top edge   (y = +hh): arrows point RIGHT (+1,0)
    addChevron(-hw + t * planeW,  hh - inset,  1,  0, colTop);

    // Bottom edge(y = -hh): arrows point LEFT  (-1,0) ← antipodal twist
    addChevron(-hw + (1 - t) * planeW, -hh + inset, -1,  0, colBot);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('color',    new THREE.Float32BufferAttribute(colors,    3));
  return geo;
}

// ─── Main component ───────────────────────────────────────────────────────
export function RP2GridBackground({ opacity = 1.0 }) {
  const arrowRef = useRef();

  // Geometry — created once
  const planeGeo = useMemo(
    () => new THREE.PlaneGeometry(PLANE_W, PLANE_H, SEG_X, SEG_Y),
    []
  );

  const arrowGeo = useMemo(
    () => buildArrowGeometry(PLANE_W, PLANE_H),
    []
  );

  // Shader material
  const planeMat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: {
          uTime:   { value: 0 },
          uGridN:  { value: 30.0 },
          uMinW:   { value: 0.018 },
          uMajW:   { value: 0.028 },
          uAlpha:  { value: opacity },
        },
        vertexShader,
        fragmentShader,
        transparent: true,
        side:       THREE.DoubleSide,
        depthWrite: false,
        blending:   THREE.NormalBlending,
      }),
    [] // eslint-disable-line react-hooks/exhaustive-deps
  );

  // Arrow line material
  const arrowMat = useMemo(
    () =>
      new THREE.LineBasicMaterial({
        vertexColors: true,
        transparent:  true,
        opacity:      0.60 * opacity,
        depthWrite:   false,
        blending:     THREE.NormalBlending,
      }),
    [] // eslint-disable-line react-hooks/exhaustive-deps
  );

  // Keep uAlpha in sync if parent changes opacity prop
  useEffect(() => {
    planeMat.uniforms.uAlpha.value = opacity;
    arrowMat.opacity               = 0.55 * opacity;
  }, [opacity, planeMat, arrowMat]);

  useFrame(({ clock }) => {
    planeMat.uniforms.uTime.value = clock.getElapsedTime() * 0.65;
  });

  return (
    <group position={[0, 1.0, -5]}>
      <mesh geometry={planeGeo} material={planeMat} />
      <lineSegments ref={arrowRef} geometry={arrowGeo} material={arrowMat} />
    </group>
  );
}
