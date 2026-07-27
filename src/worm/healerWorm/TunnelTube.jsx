// src/worm/healerWorm/TunnelTube.jsx
//
// The wormhole made into an actual enclosure.
//
// Before this, riding a wormhole meant flying along a thin Möbius ribbon inside
// the large empty volume of the cube, with all six interior walls filling the
// frame at full saturation. The composition read as "I am in a red room", not
// "I am in a tunnel" — the ribbon was a floor, and nothing enclosed the camera.
//
// TunnelTube sweeps a tube around the exact centerline the ribbon and the worm
// already follow (getTunnelWorldPosInto). The Möbius ribbon stays visible within
// it as the track being ridden; the tube is the shaft around it.
//
// The cross-section frame is parallel-transported along the path rather than
// rebuilt from a fixed up-vector: the centerline turns a corner at the core
// (entry arm → exit arm), and a naive frame flips there, which would twist the
// whole tube in one frame.

import { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useGameStore } from '../../hooks/useGameStore.js';
import { getTunnelWorldPosInto } from '../wormLogic.js';
import { FACE_COLORS } from '../../utils/constants.js';
import { resolveColors } from '../../utils/colorSchemes.js';

const RINGS = 64;            // samples along the tunnel
const SIDES = 24;            // samples around the circumference — below ~20 the bore
                             // reads as a visible polygon from the inside
const VERT_COUNT = (RINGS + 1) * (SIDES + 1);

// Radius profile, tile → core → tile.
//
// The centerline is a polyline: an entry arm, a short crossing through the core,
// then an exit arm. When the two tiles are on different axes the arms meet at a
// sharp corner in the middle, and putting the tube's widest point on that corner
// makes it read as two mismatched barrels butted together rather than one shaft.
// So the bore pinches at the core as well as at each tile, and bulges over the
// middle of each arm instead — the corner sits in the narrow part, and the
// fragment shader fades the wall out across it entirely.
// Kept deliberately snug. The camera rides 0.32 off the axis, so the bore only
// has to clear that; anything wider fills the frame and swallows both the ribbon
// and the cube around it.
const R_MOUTH  = 0.34;       // where the tunnel meets its tile (sticker is ~0.88 wide)
const R_THROAT = 0.58;       // at the core crossing — still clears the camera's offset
const R_CORE   = 0.82;       // widest point, over the middle of each arm

// Opacity targets by phase. A faint presence during 'entering' foreshadows the
// shaft while the camera is still outside watching the dive; the fade-out is
// quick so the tube is gone by the time the exterior exit shot settles.
const OP_RIDE = 1.0;
const OP_ENTER = 0.20;
const OP_LERP_IN = 6;
const OP_LERP_OUT = 9;

const _c0 = new THREE.Vector3();
const _c1 = new THREE.Vector3();
const _tan = new THREE.Vector3();
const _prevTan = new THREE.Vector3();
const _nrm = new THREE.Vector3();
const _bin = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _tmp = new THREE.Vector3();

const vertexShader = `
  varying vec2 vUv;
  varying vec3 vViewPos;
  void main() {
    vUv = uv;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vViewPos = mv.xyz;
    gl_Position = projectionMatrix * mv;
  }
`;

// vUv.y runs 0 (entry mouth) → 1 (exit mouth); vUv.x wraps the circumference.
const fragmentShader = `
  uniform vec3  uColorA;
  uniform vec3  uColorB;
  uniform float uTime;
  uniform float uOpacity;
  uniform float uHead;      // 0→1 position of the worm along the tunnel

  varying vec2 vUv;
  varying vec3 vViewPos;

  void main() {
    // Each half carries its own tile's colour, fusing at the midpoint — the same
    // language the ribbon uses, so tube and ribbon read as one object. Lifted
    // toward white because face colours can be very dark (deep reds especially),
    // and a shaft lit only by its own tile colour goes black.
    vec3 base = mix(uColorA, uColorB, smoothstep(0.35, 0.65, vUv.y));
    base = mix(base, vec3(1.0), 0.10);

    // Rings racing past the camera. This is the speed cue: on a bare ribbon
    // there was nothing in the periphery to register motion against.
    float ring = fract(vUv.y * 26.0 - uTime * 2.4);
    float rings = smoothstep(0.85, 1.0, ring) * 0.9;

    // Longitudinal ribs give the bore a readable cross-section so it reads as a
    // round shaft rather than a flat backdrop.
    float ribs = pow(abs(sin(vUv.x * 3.14159265 * 8.0)), 6.0) * 0.35;

    // The half-twist point — where the band's orientation inverts. The HUD marks
    // it as ½π; this is the same moment in the world. Widened to span the stretch
    // where the wall is faded out, so the crossing reads as a burst of light
    // between two shafts rather than as a hole.
    float dMid = abs(vUv.y - 0.5);
    float seam = 1.0 - smoothstep(0.0, 0.15, dMid);
    seam *= 0.9 + 0.1 * sin(uTime * 8.0);

    // Never draw the wall across the corner where the two arms meet — no frame
    // can carry a cross-section smoothly through a sharp bend, and the result
    // reads as two barrels that do not line up.
    float coreFade = smoothstep(0.05, 0.15, dMid);

    // Light pooled around the worm, falling off ahead and behind, so the shaft
    // has depth instead of being uniformly lit end to end. The falloff has to be
    // wide: anchoring tunnels on their tiles made each arm ~5x longer, so a tight
    // pool leaves almost the whole shaft unlit.
    float headGlow = exp(-pow((vUv.y - uHead) / 0.32, 2.0)) * 0.75;

    // Both mouths open out to nothing so the tube never ends in a hard disc, and
    // so the ends do not read as geometry hanging outside the cube.
    float mouth = smoothstep(0.0, 0.16, vUv.y) * smoothstep(1.0, 0.84, vUv.y);

    // Grazing incidence brightening: walls far down the bore catch more light,
    // which is what sells a cylinder when you are standing inside it.
    vec3  V = normalize(-vViewPos);
    float graze = 1.0 - abs(V.z);
    graze = pow(clamp(graze, 0.0, 1.0), 2.0) * 0.5;

    // The floor carries the whole shaft away from the worm, so it cannot be dim.
    float intensity = 0.50 + rings * 0.8 + ribs + headGlow + graze;
    vec3  col = base * intensity + vec3(1.0) * seam * 0.9;

    // Wall and seam are summed separately: the seam peaks exactly where coreFade
    // removes the wall, so the shaft hands off to light and back without a gap.
    // Translucent on purpose: the Möbius ribbon runs down the middle of this
    // shaft and the cube's interior sits beyond it, and both have to stay
    // readable through the wall rather than being sealed off by it.
    float wall = (0.34 + rings * 0.30 + headGlow * 0.22) * coreFade;
    float glow = seam * 0.55;
    gl_FragColor = vec4(col, clamp((wall + glow) * mouth * uOpacity, 0.0, 1.0));
  }
`;

function createTubeGeometry() {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(VERT_COUNT * 3), 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(VERT_COUNT * 2), 2));

  const idx = [];
  for (let i = 0; i < RINGS; i++) {
    for (let j = 0; j < SIDES; j++) {
      const a = i * (SIDES + 1) + j;
      const b = a + SIDES + 1;
      idx.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }
  geo.setIndex(idx);
  return geo;
}

/** Tight at both tile mouths and at the core, bulging over the middle of each arm. */
function radiusAt(t) {
  const c = Math.min(1, Math.max(0, t));
  // Widens from each tile mouth toward the core crossing.
  const base = R_MOUTH + (R_THROAT - R_MOUTH) * Math.sin(Math.PI * c);
  // Peaks at t=0.25 and t=0.75, and is exactly zero at both mouths and the core.
  const arm = Math.abs(Math.sin(2 * Math.PI * c));
  return base + (R_CORE - R_THROAT) * arm;
}

export function TunnelTube({ worm, size }) {
  const meshRef = useRef();
  const opacityRef = useRef(0);
  const builtForRef = useRef(null);

  const geo = useMemo(() => createTubeGeometry(), []);
  const uniforms = useMemo(() => ({
    uColorA:  { value: new THREE.Color('#00aaff') },
    uColorB:  { value: new THREE.Color('#ff8800') },
    uTime:    { value: 0 },
    uOpacity: { value: 0 },
    uHead:    { value: 0 },
  }), []);

  useEffect(() => () => geo.dispose(), [geo]);

  /**
   * Sweep the tube along the centerline. Called only when the active tunnel
   * changes — the path is fixed for the duration of a traversal.
   */
  const rebuild = (tunnel) => {
    const pos = geo.attributes.position.array;
    const uv = geo.attributes.uv.array;

    // Seed the transported frame with any vector not parallel to the first tangent.
    getTunnelWorldPosInto(_c0, tunnel, 0, size);
    getTunnelWorldPosInto(_c1, tunnel, 1 / RINGS, size);
    _prevTan.subVectors(_c1, _c0);
    if (_prevTan.lengthSq() < 1e-8) _prevTan.set(0, 0, 1);
    _prevTan.normalize();
    _tmp.set(0, 1, 0);
    if (Math.abs(_tmp.dot(_prevTan)) > 0.95) _tmp.set(1, 0, 0);
    _nrm.crossVectors(_prevTan, _tmp).normalize();

    for (let i = 0; i <= RINGS; i++) {
      const t = i / RINGS;
      getTunnelWorldPosInto(_c0, tunnel, t, size);
      getTunnelWorldPosInto(_c1, tunnel, Math.min(1, t + 1 / RINGS), size);
      _tan.subVectors(_c1, _c0);
      if (_tan.lengthSq() < 1e-8) _tan.copy(_prevTan);
      else _tan.normalize();

      // Parallel transport: carry the previous normal through the rotation that
      // takes the previous tangent onto this one. Rebuilding the frame from a
      // fixed up-vector instead would flip it where the path turns at the core.
      _q.setFromUnitVectors(_prevTan, _tan);
      _nrm.applyQuaternion(_q);
      // Re-orthogonalise against drift.
      _nrm.addScaledVector(_tan, -_nrm.dot(_tan));
      if (_nrm.lengthSq() < 1e-8) {
        _tmp.set(0, 1, 0);
        if (Math.abs(_tmp.dot(_tan)) > 0.95) _tmp.set(1, 0, 0);
        _nrm.crossVectors(_tan, _tmp);
      }
      _nrm.normalize();
      _bin.crossVectors(_tan, _nrm).normalize();
      _prevTan.copy(_tan);

      const r = radiusAt(t);
      for (let j = 0; j <= SIDES; j++) {
        const a = (j / SIDES) * Math.PI * 2;
        const ca = Math.cos(a) * r;
        const sa = Math.sin(a) * r;
        const vi = i * (SIDES + 1) + j;
        pos[vi * 3]     = _c0.x + _nrm.x * ca + _bin.x * sa;
        pos[vi * 3 + 1] = _c0.y + _nrm.y * ca + _bin.y * sa;
        pos[vi * 3 + 2] = _c0.z + _nrm.z * ca + _bin.z * sa;
        uv[vi * 2]      = j / SIDES;
        uv[vi * 2 + 1]  = t;
      }
    }
    geo.attributes.position.needsUpdate = true;
    geo.attributes.uv.needsUpdate = true;
  };

  useFrame((_state, delta) => {
    const phase = worm.phase.current;
    const tunnel = worm.activeTunnel.current;
    const riding = phase === 'tunnel' || phase === 'exiting';
    const entering = phase === 'entering';

    const target = riding ? OP_RIDE : entering ? OP_ENTER : 0;
    const lerp = target > opacityRef.current ? OP_LERP_IN : OP_LERP_OUT;
    opacityRef.current += (target - opacityRef.current) * Math.min(1, delta * lerp);

    uniforms.uTime.value += delta;
    uniforms.uOpacity.value = opacityRef.current;

    if (!meshRef.current) return;
    if (!tunnel || opacityRef.current < 0.01) {
      meshRef.current.visible = false;
      builtForRef.current = null;
      return;
    }
    meshRef.current.visible = true;

    const key = tunnel.pairId ?? `${tunnel.entry?.dirKey}-${tunnel.exit?.dirKey}`;
    if (builtForRef.current !== key) {
      const st = useGameStore.getState();
      const fc = resolveColors(st.settings, st.settings?.biomeMode?.faceAssignment) || FACE_COLORS;
      uniforms.uColorA.value.set(fc[tunnel.entryColor] ?? FACE_COLORS[tunnel.entryColor] ?? '#00aaff');
      uniforms.uColorB.value.set(fc[tunnel.exitColor] ?? FACE_COLORS[tunnel.exitColor] ?? '#ff8800');
      rebuild(tunnel);
      builtForRef.current = key;
    }

    // Head position along the full traversal, matching WormChaseCamera's mapping
    // of per-phase progress onto the 0→1 tunnel parameter.
    const tp = worm.tunnelProgress.current ?? 0;
    uniforms.uHead.value = phase === 'tunnel' ? 0.33 + tp * 0.34
      : phase === 'exiting' ? 0.67 + tp * 0.33
        : tp * 0.33;
  });

  return (
    // Positions are written in world space, so culling against the stale
    // bounding sphere would pop the tube out of view.
    <mesh ref={meshRef} geometry={geo} frustumCulled={false} renderOrder={2}>
      <shaderMaterial
        uniforms={uniforms}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        // This sweep's winding makes the INNER surface front-facing, which is why
        // BackSide showed nothing from inside the ride. DoubleSide fixed that but
        // overcorrected: drawing the near wall as well turned the shaft into a
        // closed barrel that hid the Möbius ribbon inside it, blacked out the cube
        // beyond it, and made the far arm read as a solid tube cutting across the
        // view. FrontSide draws the bore you are looking down and culls the
        // outside, so the ribbon and the cube stay visible through it.
        side={THREE.FrontSide}
        transparent
        depthWrite={false}
      />
    </mesh>
  );
}

export default TunnelTube;
