import { useRef, useEffect, useMemo } from 'react';
import { useGameStore } from '../hooks/useGameStore.js';
import { useShallow } from 'zustand/react/shallow';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { LoftGeometry } from '../3d/geometries/LoftGeometry.js';
import { FLIP_CAP } from '../utils/constants.js';
import { tunnelState } from '../worm/tunnelProgressBridge.js';

// Opacity multiplier when the worm is traversing a different tunnel.
// Inactive tunnels stay at 75 % — fully visible at all times in worm mode.
const DIM_OPACITY  = 0.75;
const FULL_OPACITY = 1.0;
const DIM_LERP_DOWN = 6;   // fade-out speed (× delta)
const DIM_LERP_UP   = 20;  // snap-in speed  (× delta) — nearly instant

const FACE_NORM_LOCAL = {
  PX: [1, 0, 0], NX: [-1, 0, 0],
  PY: [0, 1, 0], NY: [0, -1, 0],
  PZ: [0, 0, 1], NZ: [0, 0, -1],
};

const FACE_OFFSET    = 0.52;
const RIBBON_WIDTH   = 0.85;
const RIBBON_SEGS    = 64;   // must be even — split evenly across the two arms
const ROWS_PER_ARM   = RIBBON_SEGS / 2 + 1;
const REBUILD_EPS_SQ = 1e-4;
const MINI_FACE_R    = 0.25; // must match MINI_S in VoidCore.jsx
const TAPER_MIN      = 0.15; // narrowest fraction of full width at the mini-cube
const BUMPER_HEIGHT  = 0.30; // guard-rail height at full width — increased from 0.22
const TROUGH_DEPTH   = 0.05; // channel depth at full width — gives the ribbon real cross-section
const INNER_FRAC     = 0.55; // fraction of half-width where the channel floor sits

// Geometry rebuild is throttled and scaled down as tunnel count grows, the same
// strategy WormholeTunnel uses to keep total alloc+dispose rate bounded when
// chaos mode spawns 100+ tunnels at once.
let activeMobiusCount = 0;
const MOBIUS_REBUILD_FPS = 12;
const MOBIUS_COUNT_PER_FPS_STEP = 30;
const mobiusRebuildInterval = () =>
  (1 / MOBIUS_REBUILD_FPS) * Math.max(1, Math.ceil(activeMobiusCount / MOBIUS_COUNT_PER_FPS_STEP));

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
const _armTangent    = new THREE.Vector3();
const _surfaceNormal = new THREE.Vector3();
const _midC          = new THREE.Vector3();
const _up            = new THREE.Vector3(0, 1, 0);
const _side          = new THREE.Vector3(0, 0, 1);
const _portalPos     = new THREE.Vector3();

// Vertex shader: pass UV and position through to fragment.
const vertexShader = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

// Ribbon fragment shader.
// LoftGeometry's UV convention is (alongPath, acrossSection) — opposite of the old
// hand-rolled strip, so vUv.x now carries what used to be vUv.y and vice versa.
// vUv.x: 0 = tile1 end, 0.5 = centre (VoidCore), 1 = tile2 end.
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
  varying vec2  vUv;

  void main() {
    // Tunnel birth grow-in: left beam from tile1 toward centre, right beam from tile2.
    float leftFront  = uGrowT * 0.5;
    float rightFront = 1.0 - uGrowT * 0.5;
    if (vUv.x > leftFront && vUv.x < rightFront) discard;

    // Each half shows only its own tile's color.
    vec3 tileColor = vUv.x < 0.5 ? uColorA : uColorB;

    // Scroll toward centre from each tile end (halfPos: 0=tile edge, 1=centre).
    float halfPos = vUv.x < 0.5 ? vUv.x * 2.0 : (1.0 - vUv.x) * 2.0;
    float scroll  = fract(halfPos * 4.0 - uTime * uScrollSpeed);

    // Leading-edge velocity spark
    float spark = (1.0 - smoothstep(0.0, 0.08, scroll)) * 0.6;

    // Cylindrical depth illusion across the channel cross-section (now backed by
    // real loft geometry depth, not just a fake shading curve on a flat plane).
    float centerBulge = 1.0 - pow(abs(vUv.y * 2.0 - 1.0), 0.6);
    float shading = 0.58 + centerBulge * 0.64;

    // Depth fade: full intensity where the worm is (near halfPos=1 / midpoint),
    // softer at tile-end portals so the tunnel has visual perspective depth.
    float depthFade = 0.32 + halfPos * 0.68;

    float intensity  = (0.75 + spark + uPulseBoost * 0.3) * shading * depthFade;
    vec3  col        = tileColor * intensity;

    float edgeFade    = smoothstep(0.0, 0.14, vUv.y) * smoothstep(1.0, 0.86, vUv.y);
    float boostOpacity = uOpacity + uPulseBoost * 0.45;

    // Black border along each ribbon edge
    float leftEdge    = 1.0 - smoothstep(0.0, 0.055, vUv.y);
    float rightEdge   = 1.0 - smoothstep(1.0, 0.945, vUv.y);
    float edgeOutline = clamp(leftEdge + rightEdge, 0.0, 1.0);

    vec3  finalCol   = mix(col * (1.0 + uPulseBoost * 1.2), vec3(0.0), edgeOutline);
    float finalAlpha = max(boostOpacity * edgeFade, edgeOutline * 0.88);
    gl_FragColor = vec4(finalCol, finalAlpha);
  }
`;

// Bumper vertex shader: passes height fraction and trip fraction to fragment.
// vTripFrac (0→1 along ribbon length) lets the fragment highlight the Möbius flip point.
const bumperVertexShader = `
  attribute float aHeightFrac;
  attribute float aTripFrac;
  varying  float vHeightFrac;
  varying  float vTripFrac;
  void main() {
    vHeightFrac = aHeightFrac;
    vTripFrac   = aTripFrac;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
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
 * Sample one straight arm (start→end) into pre-allocated point pools: a 4-point
 * channel cross-section for the ribbon (outer-left, inner-left, inner-right,
 * outer-right — a shallow trough rather than a flat 2-point strip) and 2-point
 * cross-sections for the left/right bumpers (base, top).
 *
 * `tFrom`/`tTo` are the absolute [0,1] twist parameters for this arm — the
 * Möbius half-twist (perpCurrent rotated by t*PI) must stay continuous across
 * both arms even though each arm is lofted as its own geometry.
 */
function sampleArm(startPos, endPos, tFrom, tTo, axis, perpStart, width, ribbonRows, leftRows, rightRows) {
  const halfW = width / 2;
  _armTangent.subVectors(endPos, startPos).normalize();

  for (let i = 0; i < ROWS_PER_ARM; i++) {
    const s = i / (ROWS_PER_ARM - 1);
    const t = tFrom + (tTo - tFrom) * s;
    const taper = TAPER_MIN + (1.0 - TAPER_MIN) * Math.abs(2.0 * t - 1.0);
    const w     = halfW * taper;
    const depth = TROUGH_DEPTH * taper;
    const bh    = BUMPER_HEIGHT * taper;

    _midC.copy(startPos).lerp(endPos, s);
    _perpCurrent.copy(perpStart).applyAxisAngle(axis, t * Math.PI);

    _surfaceNormal.crossVectors(_armTangent, _perpCurrent);
    if (_surfaceNormal.lengthSq() < 0.001) _surfaceNormal.crossVectors(_up, _perpCurrent);
    _surfaceNormal.normalize();

    const row = ribbonRows[i];
    row[0].copy(_midC).addScaledVector(_perpCurrent, -w);
    row[1].copy(_midC).addScaledVector(_perpCurrent, -w * INNER_FRAC).addScaledVector(_surfaceNormal, -depth);
    row[2].copy(_midC).addScaledVector(_perpCurrent,  w * INNER_FRAC).addScaledVector(_surfaceNormal, -depth);
    row[3].copy(_midC).addScaledVector(_perpCurrent,  w);

    const lrow = leftRows[i];
    lrow[0].copy(_midC).addScaledVector(_perpCurrent, -w);
    lrow[1].copy(lrow[0]).addScaledVector(_surfaceNormal, bh);

    const rrow = rightRows[i];
    rrow[0].copy(_midC).addScaledVector(_perpCurrent, w);
    rrow[1].copy(rrow[0]).addScaledVector(_surfaceNormal, bh);
  }
}

// Each arm's LoftGeometry independently normalizes its U (along-path) coordinate
// to [0,1]; squeeze it into the arm's half of the full ribbon so the two arms
// read as one continuous [0,1] path once merged (tile1 → centre → tile2).
function rescaleU(geo, uMin, uMax) {
  const uv = geo.attributes.uv.array;
  for (let i = 0; i < uv.length; i += 2) {
    uv[i] = uMin + uv[i] * (uMax - uMin);
  }
}

// Concatenate two same-topology LoftGeometry outputs into one BufferGeometry,
// offsetting the second arm's indices past the first arm's vertex count.
// Disposes both source geometries once their buffers are copied.
function mergeLofts(geoA, geoB) {
  const merged = new THREE.BufferGeometry();

  const posA = geoA.attributes.position.array, posB = geoB.attributes.position.array;
  const uvA  = geoA.attributes.uv.array,       uvB  = geoB.attributes.uv.array;
  const nA   = geoA.attributes.normal.array,   nB   = geoB.attributes.normal.array;
  const vertCountA = posA.length / 3;

  const position = new Float32Array(posA.length + posB.length);
  position.set(posA, 0); position.set(posB, posA.length);
  const uv = new Float32Array(uvA.length + uvB.length);
  uv.set(uvA, 0); uv.set(uvB, uvA.length);
  const normal = new Float32Array(nA.length + nB.length);
  normal.set(nA, 0); normal.set(nB, nA.length);

  const idxA = geoA.index.array, idxB = geoB.index.array;
  const index = new idxA.constructor(idxA.length + idxB.length);
  index.set(idxA, 0);
  for (let i = 0; i < idxB.length; i++) index[idxA.length + i] = idxB[i] + vertCountA;

  merged.setAttribute('position', new THREE.BufferAttribute(position, 3));
  merged.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  merged.setAttribute('normal', new THREE.BufferAttribute(normal, 3));
  merged.setIndex(new THREE.BufferAttribute(index, 1));

  geoA.dispose();
  geoB.dispose();

  return merged;
}

/**
 * MobiusTunnel — one Möbius ribbon + two guard-rail bumpers per active antipodal sticker pair.
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
}) => {
  const meshRef          = useRef();
  const leftMeshRef       = useRef();
  const rightMeshRef      = useRef();
  const pulseT           = useRef(Math.random() * Math.PI * 2);
  const portalPulseT     = useRef(Math.random() * Math.PI * 2);
  const dimRef           = useRef(DIM_OPACITY);
  const lastStartRef     = useRef(new THREE.Vector3(Infinity, Infinity, Infinity));
  const lastEndRef       = useRef(new THREE.Vector3(Infinity, Infinity, Infinity));
  const lastBuildTRef    = useRef(-Infinity);

  // Exit portal refs — group holds position/orientation; children animate independently
  const exitPortalGroupRef  = useRef();
  const exitPortalMatRef    = useRef();
  const exitPortalGlowRef   = useRef();
  const exitPortalRing1Ref  = useRef();
  const exitPortalRing2Ref  = useRef();

  const { tunnelBirths, tunnelPulses } = useGameStore(
    useShallow(s => ({ tunnelBirths: s.tunnelBirths, tunnelPulses: s.tunnelPulses }))
  );

  // Reusable point pools, two arms × ROWS_PER_ARM rows — sampled in place every
  // rebuild instead of allocating fresh Vector3s (LoftGeometry itself still
  // allocates a fresh BufferGeometry per rebuild, same alloc/dispose pattern
  // WormholeTunnel already uses for its TubeGeometry).
  const pools = useMemo(() => {
    const makeRows = (cols) => [0, 1].map(() =>
      Array.from({ length: ROWS_PER_ARM }, () =>
        Array.from({ length: cols }, () => new THREE.Vector3())
      )
    );
    return { ribbon: makeRows(4), left: makeRows(2), right: makeRows(2) };
  }, []);

  // Bumper height/trip-fraction attributes are pure functions of row/column index,
  // independent of position, so they're computed once and reattached to each new
  // merged geometry rather than recomputed every rebuild.
  const bumperExtras = useMemo(() => {
    const vertCount = ROWS_PER_ARM * 2 * 2; // 2 arms × ROWS_PER_ARM rows × 2 cols
    const heightFrac = new Float32Array(vertCount);
    const tripFrac   = new Float32Array(vertCount);
    for (let arm = 0; arm < 2; arm++) {
      for (let i = 0; i < ROWS_PER_ARM; i++) {
        const s = i / (ROWS_PER_ARM - 1);
        const t = arm === 0 ? s * 0.5 : 0.5 + s * 0.5;
        const base = (arm * ROWS_PER_ARM + i) * 2;
        heightFrac[base] = 0; heightFrac[base + 1] = 1;
        tripFrac[base]   = t; tripFrac[base + 1]   = t;
      }
    }
    return { heightFrac, tripFrac };
  }, []);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const uniforms = useMemo(() => ({
    uColorA:      { value: new THREE.Color(color1) },
    uColorB:      { value: new THREE.Color(color2) },
    uOpacity:     { value: 0.92 },
    uTime:        { value: 0.0 },
    uScrollSpeed: { value: 1.0 },
    uGrowT:       { value: 1.0 },
    uPulseBoost:  { value: 0.0 },
  }), []);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const bumperUniformsL = useMemo(() => ({
    uColor:   { value: new THREE.Color(color1) },
    uOpacity: { value: 0.93 },
  }), []);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const bumperUniformsR = useMemo(() => ({
    uColor:   { value: new THREE.Color(color2) },
    uOpacity: { value: 0.93 },
  }), []);

  useEffect(() => {
    activeMobiusCount++;
    return () => { activeMobiusCount--; };
  }, []);

  useEffect(() => {
    const m  = meshRef.current;
    const lm = leftMeshRef.current;
    const rm = rightMeshRef.current;
    return () => {
      if (m?.geometry)  m.geometry.dispose();
      if (lm?.geometry) lm.geometry.dispose();
      if (rm?.geometry) rm.geometry.dispose();
    };
  }, []);

  useFrame((state, delta) => {
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

    // Ribbon anchors: just inside each sticker tile's back surface
    _vStart.copy(_wPos1).addScaledVector(_faceNorm1, -FACE_OFFSET);
    _vEnd  .copy(_wPos2).addScaledVector(_faceNorm2, -FACE_OFFSET);

    // Mini-cube face docking points — use LOCAL color direction so the tunnel
    // always routes through the correct colored face regardless of cube rotation.
    _midA.set(n1[0], n1[1], n1[2]).multiplyScalar(MINI_FACE_R);
    _midB.set(n2[0], n2[1], n2[2]).multiplyScalar(MINI_FACE_R);

    const moved =
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

    const elapsed = state.clock.elapsedTime;
    if (moved && (elapsed - lastBuildTRef.current >= mobiusRebuildInterval())) {
      lastBuildTRef.current = elapsed;
      lastStartRef.current.copy(_vStart);
      lastEndRef  .current.copy(_vEnd);

      // Twist axis: overall start-to-end direction
      _axis.subVectors(_vEnd, _vStart).normalize();

      // Initial cross-section direction: tangent to tile 1's face surface.
      _perpBase.crossVectors(_axis, _faceNorm1);
      if (_perpBase.lengthSq() < 0.001) _perpBase.crossVectors(_axis, _up);
      if (_perpBase.lengthSq() < 0.001) _perpBase.crossVectors(_axis, _side);
      _perpBase.normalize();

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
        // Sync ring colors to antipodal pair
        if (exitPortalRing1Ref.current) exitPortalRing1Ref.current.material.color.set(cA);
        if (exitPortalRing2Ref.current) exitPortalRing2Ref.current.material.color.set(cB);
        if (exitPortalGlowRef.current)  exitPortalGlowRef.current.material.color.set(cB);
      }

      // Sample both arms (start→midA, midB→end), Möbius twist parameterized by
      // the absolute t∈[0,1] across the *whole* path so it stays continuous.
      sampleArm(_vStart, _midA, 0, 0.5, _axis, _perpBase, RIBBON_WIDTH,
        pools.ribbon[0], pools.left[0], pools.right[0]);
      sampleArm(_midB, _vEnd, 0.5, 1, _axis, _perpBase, RIBBON_WIDTH,
        pools.ribbon[1], pools.left[1], pools.right[1]);

      const ribbonA = new LoftGeometry(pools.ribbon[0], { closed: false });
      const ribbonB = new LoftGeometry(pools.ribbon[1], { closed: false });
      rescaleU(ribbonA, 0, 0.5);
      rescaleU(ribbonB, 0.5, 1);
      const ribbonGeo = mergeLofts(ribbonA, ribbonB);

      const leftA = new LoftGeometry(pools.left[0], { closed: false });
      const leftB = new LoftGeometry(pools.left[1], { closed: false });
      const leftGeo = mergeLofts(leftA, leftB);
      leftGeo.setAttribute('aHeightFrac', new THREE.BufferAttribute(bumperExtras.heightFrac, 1));
      leftGeo.setAttribute('aTripFrac', new THREE.BufferAttribute(bumperExtras.tripFrac, 1));

      const rightA = new LoftGeometry(pools.right[0], { closed: false });
      const rightB = new LoftGeometry(pools.right[1], { closed: false });
      const rightGeo = mergeLofts(rightA, rightB);
      rightGeo.setAttribute('aHeightFrac', new THREE.BufferAttribute(bumperExtras.heightFrac, 1));
      rightGeo.setAttribute('aTripFrac', new THREE.BufferAttribute(bumperExtras.tripFrac, 1));

      const oldRibbon = meshRef.current.geometry;
      meshRef.current.geometry = ribbonGeo;
      if (oldRibbon) oldRibbon.dispose();

      if (leftMeshRef.current) {
        const oldLeft = leftMeshRef.current.geometry;
        leftMeshRef.current.geometry = leftGeo;
        if (oldLeft) oldLeft.dispose();
      }
      if (rightMeshRef.current) {
        const oldRight = rightMeshRef.current.geometry;
        rightMeshRef.current.geometry = rightGeo;
        if (oldRight) oldRight.dispose();
      }
    }

    // Dim system: inactive tunnels fade to 75%, active tunnel snaps to 100%.
    const targetDim = isActive ? FULL_OPACITY : DIM_OPACITY;
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
    if (exitPortalRing1Ref.current) {
      exitPortalRing1Ref.current.rotation.z += delta * 1.5;
      exitPortalRing1Ref.current.material.opacity = (0.65 + 0.15 * Math.sin(ppt * 1.1)) * dim;
    }
    if (exitPortalRing2Ref.current) {
      exitPortalRing2Ref.current.rotation.x += delta * 0.85;
      exitPortalRing2Ref.current.material.opacity = (0.50 + 0.12 * Math.cos(ppt * 0.9)) * dim;
    }

    // Tunnel birth: grow-in from both portal ends toward centre (first flip only)
    const birth = tunnelId ? tunnelBirths?.[tunnelId] : null;
    if (birth) {
      const rawT = (performance.now() - birth.startMs) / birth.durationMs;
      uniforms.uGrowT.value = Math.min(1, Math.max(0, rawT));
    } else {
      uniforms.uGrowT.value = 1.0;
    }

    // Tunnel pulse: brightness burst on subsequent flips
    const pulse = tunnelId ? tunnelPulses?.[tunnelId] : null;
    if (pulse) {
      const rawT = (performance.now() - pulse.startMs) / pulse.durationMs;
      uniforms.uPulseBoost.value = rawT < 1 ? Math.sin(rawT * Math.PI) : 0;
    } else {
      uniforms.uPulseBoost.value = 0;
    }

  });

  return (
    <>
      {/* Main ribbon — racing stripes scroll toward the mini-cube, speed ramps at midpoint */}
      <mesh ref={meshRef}>
        <shaderMaterial
          uniforms={uniforms}
          vertexShader={vertexShader}
          fragmentShader={fragmentShader}
          side={THREE.DoubleSide}
          transparent
          depthWrite={false}
        />
      </mesh>

      {/* Left guard rail — colorA; rotates to inverted at tile 2 via Möbius twist */}
      <mesh ref={leftMeshRef}>
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
      <mesh ref={rightMeshRef}>
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

        {/* Ring 1 — color1 (entry side color), orbits at z=0 */}
        <mesh ref={exitPortalRing1Ref}>
          <torusGeometry args={[0.36, 0.020, 8, 32]} />
          <meshBasicMaterial
            color={color1}
            transparent
            opacity={0.65}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
          />
        </mesh>

        {/* Ring 2 — color2 (exit side color), tilted 45° and counter-orbits */}
        <mesh ref={exitPortalRing2Ref} rotation={[Math.PI / 4, 0, 0]}>
          <torusGeometry args={[0.46, 0.014, 8, 32]} />
          <meshBasicMaterial
            color={color2}
            transparent
            opacity={0.50}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
          />
        </mesh>
      </group>

    </>
  );
};

export default MobiusTunnel;
