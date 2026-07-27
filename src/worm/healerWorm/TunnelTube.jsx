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
// already follow (getTunnelWorldPosInto), rendered BackSide so it is only ever
// seen from the inside. The Möbius ribbon stays visible within it as the track
// being ridden; the tube is the shaft around it.
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

// The chase camera sits ~0.55 above the centerline and up to ~1.5 behind it, so
// the bore has to clear that comfortably or the camera pops through the wall.
// The mouth flare stays small on purpose: the centerline ends INSIDE the entry
// and exit cubies, so a wide mouth balloons out through the neighbouring faces
// and reads as smears hanging off the cube in the exterior shots.
const R_CORE = 1.15;         // radius at the Möbius midpoint
const R_FLARE = 0.22;        // extra radius added toward each mouth

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
    // language the ribbon uses, so tube and ribbon read as one object.
    vec3 base = mix(uColorA, uColorB, smoothstep(0.35, 0.65, vUv.y));

    // Rings racing past the camera. This is the speed cue: on a bare ribbon
    // there was nothing in the periphery to register motion against.
    float ring = fract(vUv.y * 26.0 - uTime * 2.4);
    float rings = smoothstep(0.85, 1.0, ring) * 0.9;

    // Longitudinal ribs give the bore a readable cross-section so it reads as a
    // round shaft rather than a flat backdrop.
    float ribs = pow(abs(sin(vUv.x * 3.14159265 * 8.0)), 6.0) * 0.35;

    // The half-twist point — where the band's orientation inverts. The HUD marks
    // it as ½π; this is the same moment in the world.
    float seam = 1.0 - smoothstep(0.0, 0.06, abs(vUv.y - 0.5));
    seam *= 0.9 + 0.1 * sin(uTime * 8.0);

    // Light pooled around the worm, falling off ahead and behind, so the shaft
    // has depth instead of being uniformly lit end to end.
    float headGlow = exp(-pow((vUv.y - uHead) / 0.13, 2.0)) * 0.85;

    // Both mouths open out to nothing so the tube never ends in a hard disc, and
    // so the ends do not read as geometry hanging outside the cube.
    float mouth = smoothstep(0.0, 0.16, vUv.y) * smoothstep(1.0, 0.84, vUv.y);

    // Grazing incidence brightening: walls far down the bore catch more light,
    // which is what sells a cylinder when you are standing inside it.
    vec3  V = normalize(-vViewPos);
    float graze = 1.0 - abs(V.z);
    graze = pow(clamp(graze, 0.0, 1.0), 2.0) * 0.5;

    float intensity = 0.30 + rings + ribs + headGlow + graze;
    vec3  col = base * intensity + vec3(1.0) * seam * 0.8;

    float alpha = (0.55 + rings * 0.35 + headGlow * 0.35 + seam * 0.4) * mouth * uOpacity;
    gl_FragColor = vec4(col, clamp(alpha, 0.0, 1.0));
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

/** Radius profile: narrow through the core, flaring open at both mouths. */
function radiusAt(t) {
  const d = Math.abs(2 * t - 1);       // 0 at midpoint, 1 at the mouths
  return R_CORE + R_FLARE * d * d;
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
    // BackSide: the shaft is only ever meant to be seen from within, and this
    // keeps it from becoming an opaque sausage in the exterior shots.
    // Positions are written in world space, so culling against the stale
    // bounding sphere would pop the tube out of view.
    <mesh ref={meshRef} geometry={geo} frustumCulled={false} renderOrder={2}>
      <shaderMaterial
        uniforms={uniforms}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        side={THREE.BackSide}
        transparent
        depthWrite={false}
      />
    </mesh>
  );
}

export default TunnelTube;
