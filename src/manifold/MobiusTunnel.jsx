import { useRef, useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { FLIP_CAP, TUNNEL_ANCHOR_OFFSET } from '../utils/constants.js';
import { tunnelState } from '../worm/tunnelProgressBridge.js';
import { applyTileFlipMotion, flipWidthPulse } from './tunnelAnchorMotion.js';

// Opacity multiplier when the worm is traversing a different tunnel.
// While a traversal is underway, tunnels the worm is NOT in recede to this
// faint level so the active tunnel reads clearly. When no traversal is
// underway (WORM_IDLE_OPACITY) every tunnel stays comfortably visible.
const DIM_OPACITY       = 0.22;
const WORM_IDLE_OPACITY = 0.75;
const FULL_OPACITY      = 1.0;
const DIM_LERP_DOWN = 6;   // fade-out speed (× delta)
const DIM_LERP_UP   = 20;  // snap-in speed  (× delta) — nearly instant

const FACE_NORM_LOCAL = {
  PX: [1, 0, 0], NX: [-1, 0, 0],
  PY: [0, 1, 0], NY: [0, -1, 0],
  PZ: [0, 0, 1], NZ: [0, 0, -1],
};

const RIBBON_WIDTH   = 0.85;
const RIBBON_SEGS    = 64;   // must be even — doubled from 32 for smoother curves
const REBUILD_EPS_SQ = 1e-4;
const MINI_FACE_R    = 0.25; // must match MINI_S in VoidCore.jsx
const TAPER_MIN      = 0.15; // narrowest fraction of full width at the mini-cube
const BUMPER_HEIGHT  = 0.30; // guard-rail height at full width — increased from 0.22

// Module-level cached objects — no per-frame allocation.
const _wPos1         = new THREE.Vector3();
const _wPos2         = new THREE.Vector3();
const _wQuat1        = new THREE.Quaternion();
const _wQuat2        = new THREE.Quaternion();
const _faceNorm1     = new THREE.Vector3();
const _faceNorm2     = new THREE.Vector3();
const _vStart        = new THREE.Vector3();
const _vEnd          = new THREE.Vector3();
const _midA          = new THREE.Vector3();
const _midB          = new THREE.Vector3();
const _axis          = new THREE.Vector3();
const _perpBase      = new THREE.Vector3();
const _perpCurrent   = new THREE.Vector3();
const _segTangent    = new THREE.Vector3();
const _surfaceNormal = new THREE.Vector3();
const _up            = new THREE.Vector3(0, 1, 0);
const _side          = new THREE.Vector3(0, 0, 1);
const _portalPos     = new THREE.Vector3();
const _whipAxis      = new THREE.Vector3();

// Vertex shader: pass UV + world position through to fragment.
// vWorldPos feeds the fresnel silhouette glow (needs a view direction).
const vertexShader = `
  uniform vec3  uWhipAxis;   // world-space direction the ribbon snaps along
  uniform float uWhipAmp;    // 0 when idle; decaying envelope during a flip
  uniform float uWhipPhase;  // advances with the soliton, so the wave travels

  varying vec2 vUv;
  varying vec3 vWorldPos;

  void main() {
    vUv = uv;
    vec4 wp = modelMatrix * vec4(position, 1.0);

    // Whip: a travelling transverse wave along the ribbon, pinned to zero at
    // both tile ends so the anchors stay welded to their stickers. This is what
    // makes a flip read as a physical event rather than only a brightness pop —
    // the ribbon snaps taut as the soliton runs through it.
    float ends = sin(vUv.y * 3.14159265);
    wp.xyz += uWhipAxis * (sin(vUv.y * 12.0 - uWhipPhase) * uWhipAmp * ends);

    vWorldPos = wp.xyz;
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;

// Ribbon fragment shader.
// vUv.y: 0 = tile1 end, 0.5 = centre (VoidCore), 1 = tile2 end.
// Each half is the solid color of its own tile — no cross-blending.
// Scroll flows toward the centre from both ends so movement reads as "into the tunnel".
// uScrollSpeed is modulated by tunnel progress so it accelerates at the Möbius midpoint.
const fragmentShader = `
  uniform vec3  uColorA;
  uniform vec3  uColorB;
  uniform float uOpacity;
  uniform float uTime;
  uniform float uScrollSpeed;
  uniform float uGrowT;
  uniform float uPulseBoost;
  uniform float uSolitonProgress;  // 0→1 position of the flip pulse along the ribbon
  uniform float uSolitonAmp;       // 0 when no pulse, sin-eased envelope while travelling
  varying vec2  vUv;
  varying vec3  vWorldPos;

  // Cheap hash for per-column parallax variation (streaks at different "radii").
  float hash(float n) { return fract(sin(n * 91.3458) * 47453.5453); }

  void main() {
    // Tunnel birth grow-in: left beam from tile1 toward centre, right beam from tile2.
    float leftFront  = uGrowT * 0.5;
    float rightFront = 1.0 - uGrowT * 0.5;
    if (vUv.y > leftFront && vUv.y < rightFront) discard;

    // Each half shows its own tile's color …
    vec3 tileColor = vUv.y < 0.5 ? uColorA : uColorB;

    // … but at the Möbius midpoint the two colors fuse into a bright plasma bridge —
    // the visual statement that these two tiles are the SAME point in RP2. (#3)
    float seam = 1.0 - smoothstep(0.0, 0.17, abs(vUv.y - 0.5));
    seam *= seam;
    float seamFlicker = 0.82 + 0.18 * sin(uTime * 6.0 + vUv.x * 12.0);
    vec3  plasmaCol   = mix((uColorA + uColorB) * 0.7, vec3(1.0), 0.35);
    tileColor = mix(tileColor, plasmaCol, seam * seamFlicker);

    // Scroll toward centre from each tile end (halfPos: 0=tile edge, 1=centre).
    float halfPos = vUv.y < 0.5 ? vUv.y * 2.0 : (1.0 - vUv.y) * 2.0;

    // Near racing stripes.
    float scroll = fract(halfPos * 4.0 - uTime * uScrollSpeed);
    float spark  = (1.0 - smoothstep(0.0, 0.08, scroll)) * 0.6;

    // Far parallax warp-streaks: finer, slower, per-column offset. Two speeds read
    // as depth — you're looking INTO a shaft, not at a painted band. (#2)
    float colOff    = hash(floor(vUv.x * 7.0));
    float farScroll = fract(halfPos * 9.0 - uTime * uScrollSpeed * 0.42 + colOff);
    float farStreak = (1.0 - smoothstep(0.0, 0.045, farScroll)) * 0.32;

    // Cylindrical depth illusion: ribbon reads as a 3D tube rather than a flat band.
    // centerBulge peaks at U=0.5 (ribbon centre) and falls off toward edges.
    float centerBulge = 1.0 - pow(abs(vUv.x * 2.0 - 1.0), 0.6);
    float shading = 0.58 + centerBulge * 0.64;

    // Depth fade: full intensity where the worm is (near halfPos=1 / midpoint),
    // softer at tile-end portals so the tunnel has visual perspective depth.
    float depthFade = 0.32 + halfPos * 0.68;

    // Fresnel silhouette glow — reconstruct the flat ribbon normal from screen-space
    // derivatives and glow at grazing angles, so the tunnel reads as a lit volume. (#1)
    vec3  dpdx  = dFdx(vWorldPos);
    vec3  dpdy  = dFdy(vWorldPos);
    vec3  ncr   = cross(dpdx, dpdy);
    vec3  N     = length(ncr) > 1e-6 ? normalize(ncr) : vec3(0.0, 0.0, 1.0);
    vec3  V     = normalize(cameraPosition - vWorldPos);
    float fres  = pow(1.0 - abs(dot(N, V)), 3.0);

    // Travelling light-soliton: a flip fires a bright pulse from the entry tile,
    // through the centre, out to its antipodal partner — the identification event. (#5)
    float sol = exp(-pow((vUv.y - uSolitonProgress) / 0.055, 2.0)) * uSolitonAmp;

    float intensity = (0.75 + spark + farStreak * depthFade + uPulseBoost * 0.3) * shading * depthFade;
    intensity += seam * 0.85;   // plasma bridge blooms
    intensity += fres * 0.9;    // rim glow
    intensity += sol * 1.6;     // travelling pulse

    vec3 col = tileColor * intensity;
    col = mix(col, vec3(1.0), clamp(sol, 0.0, 0.85)); // soliton core reads white-hot

    float edgeFade     = smoothstep(0.0, 0.14, vUv.x) * smoothstep(1.0, 0.86, vUv.x);
    float boostOpacity = uOpacity + uPulseBoost * 0.45 + fres * 0.35 + sol * 0.5;

    // Black border along each ribbon edge
    float leftEdge    = 1.0 - smoothstep(0.0, 0.055, vUv.x);
    float rightEdge   = 1.0 - smoothstep(1.0, 0.945, vUv.x);
    float edgeOutline = clamp(leftEdge + rightEdge, 0.0, 1.0);

    vec3  finalCol   = mix(col * (1.0 + uPulseBoost * 1.2), vec3(0.0), edgeOutline);
    float finalAlpha = max(boostOpacity * edgeFade, edgeOutline * 0.88);
    gl_FragColor = vec4(finalCol, finalAlpha);
  }
`;

// Bumper vertex shader: passes height fraction and trip fraction to fragment.
// vTripFrac (0→1 along ribbon length) lets the fragment highlight the Möbius flip point.
const bumperVertexShader = `
  uniform vec3  uWhipAxis;
  uniform float uWhipAmp;
  uniform float uWhipPhase;

  attribute float aHeightFrac;
  attribute float aTripFrac;
  varying  float vHeightFrac;
  varying  float vTripFrac;

  void main() {
    vHeightFrac = aHeightFrac;
    vTripFrac   = aTripFrac;

    // Same whip displacement as the ribbon, driven by the SAME uniform objects
    // (shared by reference below) — otherwise the guard rails would stay put
    // while the ribbon snapped out from under them.
    vec3  p    = position;
    float ends = sin(aTripFrac * 3.14159265);
    p += uWhipAxis * (sin(aTripFrac * 12.0 - uWhipPhase) * uWhipAmp * ends);

    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  }
`;

// Bumper fragment shader: solid neon colour, fading at the top edge.
// The Möbius half-twist continuously rotates the surface normal, so the
// bumper that starts pointing "up" at tile 1 ends pointing "down" at tile 2
// — the non-orientability of RP2 made physically visible.
// At the halfway point (vTripFrac ≈ 0.5) a bright glow marks the exact flip moment.
const bumperFragmentShader = `
  uniform vec3  uColor;
  uniform float uOpacity;
  varying float vHeightFrac;
  varying float vTripFrac;

  void main() {
    float topFade = 1.0 - smoothstep(0.6, 1.0, vHeightFrac);

    // Möbius flip highlight: glows white near the halfway point (t=0.5),
    // where the surface normal has rotated 90° and non-orientability is most dramatic.
    float flipDist = abs(vTripFrac - 0.5);
    float flipGlow = smoothstep(0.10, 0.0, flipDist);

    // Black outline at base and top of each guard rail — makes bumpers feel like solid barriers
    float baseOutline = 1.0 - smoothstep(0.0, 0.15, vHeightFrac);
    float topOutline  = (1.0 - smoothstep(1.0, 0.80, vHeightFrac)) * topFade;
    float outline     = clamp(baseOutline + topOutline, 0.0, 1.0);

    // Flip point brightens toward white; rest of bumper uses neon base color
    vec3 flipColor  = mix(uColor * 2.2, vec3(1.0, 1.0, 1.0), flipGlow * 0.55);
    vec3  finalCol  = mix(flipColor * 1.8, vec3(0.0), outline);
    float finalAlpha = max(uOpacity * topFade * (1.0 + flipGlow * 0.5), outline * 0.92);
    gl_FragColor = vec4(finalCol, finalAlpha);
  }
`;

/**
 * Fill position + UV buffers for the Möbius ribbon.
 * Path: startPos → midAPos (first arm) | gap (mini-cube interior) | midBPos → endPos (second arm).
 * Width tapers from full at tile ends to TAPER_MIN fraction at the mini-cube crossing.
 * Cross-section direction (_perpCurrent) rotates π via applyAxisAngle — the Möbius half-twist.
 */
function fillRibbon(posArray, uvArray, startPos, midAPos, midBPos, endPos, axis, perpStart, segs, width, flipP1 = 0, flipP2 = 0) {
  const halfW    = width / 2;
  const halfSegs = segs / 2;

  for (let i = 0; i <= segs; i++) {
    const t     = i / segs;
    const taper = TAPER_MIN + (1.0 - TAPER_MIN) * Math.abs(2.0 * t - 1.0);
    // Swells at whichever end is mid-flip so the ribbon pulses with its tile.
    const w     = halfW * taper * flipWidthPulse(t, flipP1, flipP2);

    let cx, cy, cz;
    if (i <= halfSegs) {
      const s = i / halfSegs;
      cx = startPos.x + (midAPos.x - startPos.x) * s;
      cy = startPos.y + (midAPos.y - startPos.y) * s;
      cz = startPos.z + (midAPos.z - startPos.z) * s;
    } else {
      const s = (i - halfSegs) / halfSegs;
      cx = midBPos.x + (endPos.x - midBPos.x) * s;
      cy = midBPos.y + (endPos.y - midBPos.y) * s;
      cz = midBPos.z + (endPos.z - midBPos.z) * s;
    }

    _perpCurrent.copy(perpStart).applyAxisAngle(axis, t * Math.PI);

    for (let side = 0; side < 2; side++) {
      const sign = side === 0 ? -w : w;
      const vi   = (i * 2 + side) * 3;
      posArray[vi]     = cx + _perpCurrent.x * sign;
      posArray[vi + 1] = cy + _perpCurrent.y * sign;
      posArray[vi + 2] = cz + _perpCurrent.z * sign;
      const ui = (i * 2 + side) * 2;
      uvArray[ui]     = side;
      uvArray[ui + 1] = t;
    }
  }
}

/**
 * Fill left and right bumper geometry buffers, including aTripFrac (t along ribbon).
 *
 * Each bumper is a thin wall that rises from a ribbon edge in the direction of the
 * ribbon's surface normal (= segTangent × perpCurrent).  Because perpCurrent rotates
 * π over the full ribbon length (the Möbius half-twist), the surface normal also
 * rotates π — the bumper that is upright at tile 1 ends inverted at tile 2,
 * demonstrating RP2 non-orientability.
 */
function fillBumpers(
  leftPosArr, rightPosArr, leftHFArr, rightHFArr, leftTFArr, rightTFArr,
  startPos, midAPos, midBPos, endPos,
  axis, perpStart, segs, width
) {
  const halfW    = width / 2;
  const halfSegs = segs / 2;

  // Segment tangents for each arm (constant within each half)
  const tAx = midAPos.x - startPos.x;
  const tAy = midAPos.y - startPos.y;
  const tAz = midAPos.z - startPos.z;
  const tALen = Math.sqrt(tAx * tAx + tAy * tAy + tAz * tAz) || 1;

  const tBx = endPos.x - midBPos.x;
  const tBy = endPos.y - midBPos.y;
  const tBz = endPos.z - midBPos.z;
  const tBLen = Math.sqrt(tBx * tBx + tBy * tBy + tBz * tBz) || 1;

  for (let i = 0; i <= segs; i++) {
    const t     = i / segs;
    const taper = TAPER_MIN + (1.0 - TAPER_MIN) * Math.abs(2.0 * t - 1.0);
    const w     = halfW * taper;
    const bh    = BUMPER_HEIGHT * taper;

    // Centre position (same piecewise formula as fillRibbon)
    let cx, cy, cz;
    if (i <= halfSegs) {
      const s = i / halfSegs;
      cx = startPos.x + (midAPos.x - startPos.x) * s;
      cy = startPos.y + (midAPos.y - startPos.y) * s;
      cz = startPos.z + (midAPos.z - startPos.z) * s;
    } else {
      const s = (i - halfSegs) / halfSegs;
      cx = midBPos.x + (endPos.x - midBPos.x) * s;
      cy = midBPos.y + (endPos.y - midBPos.y) * s;
      cz = midBPos.z + (endPos.z - midBPos.z) * s;
    }

    // Width (cross-section) direction with Möbius half-twist
    _perpCurrent.copy(perpStart).applyAxisAngle(axis, t * Math.PI);

    // Segment tangent for this arm
    if (i <= halfSegs) {
      _segTangent.set(tAx / tALen, tAy / tALen, tAz / tALen);
    } else {
      _segTangent.set(tBx / tBLen, tBy / tBLen, tBz / tBLen);
    }

    // Surface normal: tangent × perpCurrent — rotates 180° over the ribbon length
    _surfaceNormal.crossVectors(_segTangent, _perpCurrent);
    if (_surfaceNormal.lengthSq() < 0.001) {
      _surfaceNormal.crossVectors(_up, _perpCurrent);
    }
    _surfaceNormal.normalize();

    // Ribbon edge positions
    const lx = cx - _perpCurrent.x * w;
    const ly = cy - _perpCurrent.y * w;
    const lz = cz - _perpCurrent.z * w;

    const rx = cx + _perpCurrent.x * w;
    const ry = cy + _perpCurrent.y * w;
    const rz = cz + _perpCurrent.z * w;

    // Bumper top positions (edge + surface-normal * height)
    const ltx = lx + _surfaceNormal.x * bh;
    const lty = ly + _surfaceNormal.y * bh;
    const ltz = lz + _surfaceNormal.z * bh;

    const rtx = rx + _surfaceNormal.x * bh;
    const rty = ry + _surfaceNormal.y * bh;
    const rtz = rz + _surfaceNormal.z * bh;

    const base = i * 2;
    // Left bumper: bottom (hf=0) then top (hf=1)
    leftPosArr[base * 3]       = lx;  leftPosArr[base * 3 + 1]   = ly;  leftPosArr[base * 3 + 2]   = lz;
    leftHFArr[base]            = 0;   leftTFArr[base]             = t;
    leftPosArr[(base+1)*3]     = ltx; leftPosArr[(base+1)*3 + 1] = lty; leftPosArr[(base+1)*3 + 2] = ltz;
    leftHFArr[base + 1]        = 1;   leftTFArr[base + 1]         = t;

    // Right bumper: bottom (hf=0) then top (hf=1)
    rightPosArr[base * 3]      = rx;  rightPosArr[base * 3 + 1]  = ry;  rightPosArr[base * 3 + 2]  = rz;
    rightHFArr[base]           = 0;   rightTFArr[base]            = t;
    rightPosArr[(base+1)*3]    = rtx; rightPosArr[(base+1)*3 + 1] = rty; rightPosArr[(base+1)*3 + 2] = rtz;
    rightHFArr[base + 1]       = 1;   rightTFArr[base + 1]        = t;
  }
}

function createRibbonGeos(segs) {
  const vertCount = (segs + 1) * 2;

  // Shared quad-strip index pattern (skip the gap at segs/2 hidden by mini-cube body)
  const mainIndices = [];
  const bumpIndices = [];
  for (let i = 0; i < segs; i++) {
    if (i === segs / 2) continue;
    const a = i * 2, b = a + 1, c = a + 2, d = a + 3;
    mainIndices.push(a, b, c, b, d, c);
    bumpIndices.push(a, b, c, b, d, c);
  }

  // Main ribbon
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(vertCount * 3), 3));
  geo.setAttribute('uv',       new THREE.BufferAttribute(new Float32Array(vertCount * 2), 2));
  geo.setIndex(mainIndices);

  // Bumper geometries — include aTripFrac (t along ribbon) for the flip-point highlight
  function makeBumperGeo() {
    const bg = new THREE.BufferGeometry();
    bg.setAttribute('position',    new THREE.BufferAttribute(new Float32Array(vertCount * 3), 3));
    bg.setAttribute('aHeightFrac', new THREE.BufferAttribute(new Float32Array(vertCount),     1));
    bg.setAttribute('aTripFrac',   new THREE.BufferAttribute(new Float32Array(vertCount),     1));
    bg.setIndex([...bumpIndices]);
    return bg;
  }

  return { geo, leftGeo: makeBumperGeo(), rightGeo: makeBumperGeo() };
}

/**
 * MobiusTunnel — the FOCUS tier: one Möbius ribbon + two guard-rail bumpers + exit portal.
 *
 * This is the expensive, high-fidelity render, and it is deliberately rare. WormholeNetwork
 * mounts at most FOCUS_BUDGET of these — the tunnel the worm is traversing plus the most
 * recent flip events — while every other active pair is drawn by RestingCords as a single
 * merged, cheaply-shaded strand. Nothing here should be made cheaper for density's sake;
 * density is the resting tier's job.
 *
 * Racing stripes scroll toward the center mini-cube from both tile ends (Rainbow Road feel).
 * Scroll speed accelerates at the Möbius midpoint (t=0.5) when the worm is traversing,
 * giving a sense of acceleration through the topological twist.
 *
 * Bumpers on each ribbon edge physically rotate 180° over the ribbon length due to the
 * Möbius half-twist, going from upright to inverted — demonstrating RP2 non-orientability.
 * A bright glow at the halfway point marks the exact flip moment.
 *
 * Exit portal shows a layered glow + orbiting rings — the destination reads as a real place.
 */
const MobiusTunnel = ({
  meshIdx1, meshIdx2, dirKey1, dirKey2, cubieRefs, flips, color1, color2, tunnelId,
  gridId1, gridId2, tunnelBirths, tunnelPulses,
}) => {
  const meshRef          = useRef();
  const pulseT           = useRef(Math.random() * Math.PI * 2);
  const portalPulseT     = useRef(Math.random() * Math.PI * 2);
  const dimRef           = useRef(WORM_IDLE_OPACITY);
  const lastStartRef     = useRef(new THREE.Vector3(Infinity, Infinity, Infinity));
  const lastEndRef       = useRef(new THREE.Vector3(Infinity, Infinity, Infinity));

  // Exit portal refs — group holds position/orientation; children animate independently
  const exitPortalGroupRef  = useRef();
  const exitPortalMatRef    = useRef();
  const exitPortalGlowRef   = useRef();

  const { geo, leftGeo, rightGeo } = useMemo(() => createRibbonGeos(RIBBON_SEGS), []);

  // Whip uniforms are created once and spread BY REFERENCE into the ribbon and
  // both bumper materials, so all three read the same {value} objects and stay
  // welded together while the ribbon snaps.
  const whipUniforms = useMemo(() => ({
    uWhipAxis:  { value: new THREE.Vector3(0, 1, 0) },
    uWhipAmp:   { value: 0.0 },
    uWhipPhase: { value: 0.0 },
  }), []);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const uniforms = useMemo(() => ({
    uColorA:      { value: new THREE.Color(color1) },
    uColorB:      { value: new THREE.Color(color2) },
    uOpacity:     { value: 0.92 },
    uTime:        { value: 0.0 },
    uScrollSpeed: { value: 1.0 },
    uGrowT:       { value: 1.0 },
    uPulseBoost:  { value: 0.0 },
    uSolitonProgress: { value: -1.0 },
    uSolitonAmp:      { value: 0.0 },
    ...whipUniforms,
  }), []);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const bumperUniformsL = useMemo(() => ({
    uColor:   { value: new THREE.Color(color1) },
    uOpacity: { value: 0.93 },
    ...whipUniforms,
  }), []);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const bumperUniformsR = useMemo(() => ({
    uColor:   { value: new THREE.Color(color2) },
    uOpacity: { value: 0.93 },
    ...whipUniforms,
  }), []);

  useEffect(() => {
    const g = geo, lg = leftGeo, rg = rightGeo;
    return () => { g.dispose(); lg.dispose(); rg.dispose(); };
  }, [geo, leftGeo, rightGeo]);

  useFrame((_state, delta) => {
    const mesh1 = cubieRefs[meshIdx1];
    const mesh2 = cubieRefs[meshIdx2];
    if (!mesh1 || !mesh2 || !meshRef.current) return;

    mesh1.getWorldPosition(_wPos1);
    mesh1.getWorldQuaternion(_wQuat1);
    mesh2.getWorldPosition(_wPos2);
    mesh2.getWorldQuaternion(_wQuat2);

    const n1 = FACE_NORM_LOCAL[dirKey1];
    const n2 = FACE_NORM_LOCAL[dirKey2];
    _faceNorm1.set(n1[0], n1[1], n1[2]).applyQuaternion(_wQuat1);
    _faceNorm2.set(n2[0], n2[1], n2[2]).applyQuaternion(_wQuat2);

    // Ribbon anchors: just inside each sticker tile's own surface, so the ribbon
    // reaches the tile the player flipped rather than the far side of its cubie.
    _vStart.copy(_wPos1).addScaledVector(_faceNorm1, TUNNEL_ANCHOR_OFFSET);
    _vEnd  .copy(_wPos2).addScaledVector(_faceNorm2, TUNNEL_ANCHOR_OFFSET);

    // Ride each tile's own flip animation — vibration into the anchors, squash
    // into the width. The anchors change every frame during a flip, so the
    // movement check below rebuilds and the ribbon shakes along with the tile.
    const flipP1 = applyTileFlipMotion(_vStart, _faceNorm1, gridId1);
    const flipP2 = applyTileFlipMotion(_vEnd, _faceNorm2, gridId2);
    const tileFlipping = flipP1 > 0 || flipP2 > 0;

    // Mini-cube face docking points — use LOCAL color direction so the tunnel
    // always routes through the correct colored face regardless of cube rotation.
    _midA.set(n1[0], n1[1], n1[2]).multiplyScalar(MINI_FACE_R);
    _midB.set(n2[0], n2[1], n2[2]).multiplyScalar(MINI_FACE_R);

    const moved = tileFlipping ||
      lastStartRef.current.distanceToSquared(_vStart) > REBUILD_EPS_SQ ||
      lastEndRef  .current.distanceToSquared(_vEnd)   > REBUILD_EPS_SQ;

    // ── Scroll speed: accelerates at midpoint during active traversal ────────
    // When the worm is inside this tunnel, ramp speed up around t=0.5 (the Möbius flip).
    // Outside traversal, constant casual scroll.
    const isActive = tunnelState.active && tunnelState.activeTunnelId === tunnelId;
    const tp = isActive ? (tunnelState.t ?? 0) : 0;
    uniforms.uScrollSpeed.value = isActive
      ? 0.7 + 3.2 * Math.sin(Math.PI * tp)
      : 1.0;
    uniforms.uTime.value += delta;

    if (moved) {
      lastStartRef.current.copy(_vStart);
      lastEndRef  .current.copy(_vEnd);

      // Twist axis: overall start-to-end direction
      _axis.subVectors(_vEnd, _vStart).normalize();

      // Initial cross-section direction: tangent to tile 1's face surface.
      _perpBase.crossVectors(_axis, _faceNorm1);
      if (_perpBase.lengthSq() < 0.001) _perpBase.crossVectors(_axis, _up);
      if (_perpBase.lengthSq() < 0.001) _perpBase.crossVectors(_axis, _side);
      _perpBase.normalize();

      // Whip displacement runs perpendicular to the ribbon SURFACE (axis × width
      // direction). Displacing along _perpBase itself would only widen the band.
      _whipAxis.crossVectors(_axis, _perpBase);
      if (_whipAxis.lengthSq() < 0.001) _whipAxis.set(0, 1, 0);
      _whipAxis.normalize();
      whipUniforms.uWhipAxis.value.copy(_whipAxis);

      const dead = flips >= FLIP_CAP;
      const cA = dead ? '#555555' : color1;
      const cB = dead ? '#444444' : color2;
      uniforms.uColorA.value.set(cA);
      uniforms.uColorB.value.set(cB);
      bumperUniformsL.uColor.value.set(cA);
      bumperUniformsR.uColor.value.set(cB);

      // Exit portal group: place between VoidCore face and exit cubie, facing inward.
      if (exitPortalGroupRef.current) {
        _portalPos.copy(_midB).addScaledVector(_faceNorm2, 0.15);
        exitPortalGroupRef.current.position.copy(_portalPos);
        exitPortalGroupRef.current.lookAt(
          _portalPos.x - _faceNorm2.x,
          _portalPos.y - _faceNorm2.y,
          _portalPos.z - _faceNorm2.z
        );
        if (exitPortalMatRef.current) exitPortalMatRef.current.color.set(cB);
        if (exitPortalGlowRef.current)  exitPortalGlowRef.current.material.color.set(cB);
      }

      fillRibbon(
        geo.attributes.position.array,
        geo.attributes.uv.array,
        _vStart, _midA, _midB, _vEnd,
        _axis, _perpBase,
        RIBBON_SEGS, RIBBON_WIDTH, flipP1, flipP2
      );
      geo.attributes.position.needsUpdate = true;
      geo.attributes.uv.needsUpdate = true;

      fillBumpers(
        leftGeo.attributes.position.array,
        rightGeo.attributes.position.array,
        leftGeo.attributes.aHeightFrac.array,
        rightGeo.attributes.aHeightFrac.array,
        leftGeo.attributes.aTripFrac.array,
        rightGeo.attributes.aTripFrac.array,
        _vStart, _midA, _midB, _vEnd,
        _axis, _perpBase,
        RIBBON_SEGS, RIBBON_WIDTH
      );
      leftGeo.attributes.position.needsUpdate    = true;
      leftGeo.attributes.aHeightFrac.needsUpdate  = true;
      leftGeo.attributes.aTripFrac.needsUpdate    = true;
      rightGeo.attributes.position.needsUpdate   = true;
      rightGeo.attributes.aHeightFrac.needsUpdate = true;
      rightGeo.attributes.aTripFrac.needsUpdate   = true;
    }

    // Dim system:
    //  • worm traversing this tunnel  → full brightness (snaps in)
    //  • worm traversing another one  → recede to DIM_OPACITY so it doesn't compete
    //  • no traversal underway        → all tunnels stay at the comfortable idle level
    const targetDim = isActive
      ? FULL_OPACITY
      : tunnelState.active
        ? DIM_OPACITY
        : WORM_IDLE_OPACITY;
    const lerpSpeed = targetDim > dimRef.current ? DIM_LERP_UP : DIM_LERP_DOWN;
    dimRef.current += (targetDim - dimRef.current) * Math.min(1, delta * lerpSpeed);
    const dim = dimRef.current;

    // Subtle opacity pulse, scaled by dim factor
    pulseT.current += delta * 1.5;
    uniforms.uOpacity.value        = (0.90 + Math.sin(pulseT.current) * 0.04) * dim;
    bumperUniformsL.uOpacity.value = (0.92 + Math.sin(pulseT.current) * 0.03) * dim;
    bumperUniformsR.uOpacity.value = (0.92 + Math.sin(pulseT.current) * 0.03) * dim;

    // ── Exit portal animation ────────────────────────────────────────────────
    // Portal pulses and breathes; rings orbit at independent rates.
    // When the active worm is approaching, portal scales up for anticipation.
    portalPulseT.current += delta * 2.2;
    const ppt = portalPulseT.current;
    const proximityBoost = isActive ? 0.18 * Math.max(0, Math.sin(Math.PI * tp)) : 0;
    const portalBreath = 1.0 + 0.08 * Math.sin(ppt) + proximityBoost;

    if (exitPortalGroupRef.current) exitPortalGroupRef.current.scale.setScalar(portalBreath);

    if (exitPortalMatRef.current) {
      exitPortalMatRef.current.opacity = (0.60 + 0.18 * Math.sin(ppt)) * dim;
    }
    if (exitPortalGlowRef.current) {
      exitPortalGlowRef.current.material.opacity = (0.30 + 0.12 * Math.sin(ppt + 0.8)) * dim;
    }

    // Tunnel birth: grow-in from both portal ends toward centre (first flip only)
    const birth = tunnelId ? tunnelBirths?.[tunnelId] : null;
    let whipAmp = 0;
    let whipPhase = 0;
    if (birth) {
      const rawT = (performance.now() - birth.startMs) / birth.durationMs;
      uniforms.uGrowT.value = Math.min(1, Math.max(0, rawT));
      // A pair's first identification snaps hardest — this happens at most once
      // per pair, so it can afford to be the biggest movement in the scene.
      if (rawT < 1) {
        const env = Math.sin(Math.max(0, rawT) * Math.PI);
        whipAmp = env * env * 0.30;
        whipPhase = rawT * 26.0;
      }
    } else {
      uniforms.uGrowT.value = 1.0;
    }

    // Tunnel pulse: on a flip, fire a travelling light-soliton from the entry tile
    // (vUv.y=0) through the centre to its antipodal partner (vUv.y=1), plus a small
    // overall brightness burst.
    const pulse = tunnelId ? tunnelPulses?.[tunnelId] : null;
    if (pulse) {
      const rawT = (performance.now() - pulse.startMs) / pulse.durationMs;
      if (rawT < 1) {
        const env = Math.sin(rawT * Math.PI);
        uniforms.uPulseBoost.value = env;
        uniforms.uSolitonProgress.value = rawT; // entry → centre → exit
        uniforms.uSolitonAmp.value = env;       // fade in/out over the trip
        // The whip rides the soliton: peaks at mid-travel and dies at both ends,
        // so the ribbon visibly snaps as the pulse runs through it. Squaring the
        // envelope keeps the movement tight rather than a slow wobble.
        whipAmp = Math.max(whipAmp, env * env * 0.16);
        whipPhase = rawT * 22.0;
      } else {
        uniforms.uPulseBoost.value = 0;
        uniforms.uSolitonAmp.value = 0;
      }
    } else {
      uniforms.uPulseBoost.value = 0;
      uniforms.uSolitonAmp.value = 0;
    }

    // Shared by reference with both bumper materials — write once.
    whipUniforms.uWhipAmp.value = whipAmp;
    whipUniforms.uWhipPhase.value = whipPhase;
  });

  return (
    <>
      {/* Main ribbon — racing stripes scroll toward the mini-cube, speed ramps at midpoint.
          frustumCulled is off on all three meshes here: vertex positions are written in world
          space into meshes parented at the origin, so the lazily-computed bounding sphere goes
          stale on the first rebuild and culling against it pops the ribbon in and out. */}
      <mesh ref={meshRef} geometry={geo} frustumCulled={false}>
        <shaderMaterial
          uniforms={uniforms}
          vertexShader={vertexShader}
          fragmentShader={fragmentShader}
          side={THREE.DoubleSide}
          transparent
          depthWrite={false}
          extensions={{ derivatives: true }}
        />
      </mesh>

      {/* Left guard rail — colorA; rotates to inverted at tile 2 via Möbius twist */}
      <mesh geometry={leftGeo} frustumCulled={false}>
        <shaderMaterial
          uniforms={bumperUniformsL}
          vertexShader={bumperVertexShader}
          fragmentShader={bumperFragmentShader}
          side={THREE.DoubleSide}
          transparent
          depthWrite={false}
        />
      </mesh>

      {/* Right guard rail — colorB; rotates to inverted at tile 2 via Möbius twist */}
      <mesh geometry={rightGeo} frustumCulled={false}>
        <shaderMaterial
          uniforms={bumperUniformsR}
          vertexShader={bumperVertexShader}
          fragmentShader={bumperFragmentShader}
          side={THREE.DoubleSide}
          transparent
          depthWrite={false}
        />
      </mesh>

      {/* Exit portal group — positioned/oriented as one unit in useFrame */}
      <group ref={exitPortalGroupRef}>
        {/* Additive glow bloom behind the portal face — larger than the portal itself */}
        <mesh ref={exitPortalGlowRef} position={[0, 0, -0.01]}>
          <planeGeometry args={[0.90, 0.90]} />
          <meshBasicMaterial
            color={color2}
            transparent
            opacity={0.30}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
            side={THREE.FrontSide}
          />
        </mesh>

        {/* Main portal face — solid exit color */}
        <mesh>
          <planeGeometry args={[0.55, 0.55]} />
          <meshBasicMaterial
            ref={exitPortalMatRef}
            color={color2}
            transparent
            opacity={0.60}
            depthWrite={false}
            side={THREE.FrontSide}
          />
        </mesh>

        {/* Orbiting torus rings removed — every tunnel's exit portal sits on the
            central mini-cube face, so with many active tunnels the rings stacked
            into a cluster of overlapping spinning circles at the cube's core.
            The portal glow + face already read the tunnel mouth without the noise. */}
      </group>

    </>
  );
};

export default MobiusTunnel;
