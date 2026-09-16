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
import { diveProgress } from '../tunnelCameraRails.js';
import { tunnelBoreRadiusAt } from '../../utils/tunnelPath.js';
import { FACE_COLORS } from '../../utils/constants.js';
import { prefersReducedMotion } from '../../utils/device.js';
import { resolveColors } from '../../utils/colorSchemes.js';

const RINGS = 64;            // samples along the tunnel
const SIDES = 24;            // samples around the circumference — below ~20 the bore
                             // reads as a visible polygon from the inside
const VERT_COUNT = (RINGS + 1) * (SIDES + 1);

// The radius profile lives in utils/tunnelPath.js, alongside the centerline it is
// swept around and the camera offset it has to clear — see tunnelBoreRadiusAt.
// The corner where the two arms meet sits in the narrow part of that profile, and
// the fragment shader softens the wall across it while retaining illumination.

// Opacity targets by phase. 'entering' starts at the faint value — a foreshadow
// of the shaft while the camera is still hanging outside — and is driven up to
// the full ride value by the dive, so the bore is at full strength at the exact
// moment the camera passes through the mouth rather than snapping on afterwards.
// Retain the shaft while any body segment occupies it; fade only after the
// recorded tail passage clears.
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
//
// Keep a luminous wall under the detail: alpha blending a dark shader over the
// black interior backing otherwise erases both the color and the sense of depth.
// Output conversion is explicit because ShaderMaterial does not add it for us.
const fragmentShader = `
  uniform vec3 uColorA;
  uniform vec3 uColorB;
  uniform float uTime;
  uniform float uOpacity;
  uniform float uHead;
  varying vec2 vUv;
  varying vec3 vViewPos;

  float hash13(vec3 p) {
    p = fract(p * 0.1031);
    p += dot(p, p.zyx + 31.32);
    return fract((p.x + p.y) * p.z);
  }
  float noise3(vec3 p) {
    vec3 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(mix(hash13(i), hash13(i + vec3(1,0,0)), f.x),
          mix(hash13(i + vec3(0,1,0)), hash13(i + vec3(1,1,0)), f.x), f.y),
      mix(mix(hash13(i + vec3(0,0,1)), hash13(i + vec3(1,0,1)), f.x),
          mix(hash13(i + vec3(0,1,1)), hash13(i + vec3(1,1,1)), f.x), f.y), f.z);
  }
  void main() {
    float y = vUv.y;
    float angle = vUv.x * 6.2831853;
    float twist = angle - y * 3.14159265;
    float coreDistance = abs(y - 0.5);
    float coreFade = smoothstep(0.045, 0.14, coreDistance);
    float mouth = smoothstep(0.0, 0.1, y) * (1.0 - smoothstep(0.90, 1.0, y));

    // Retain both palette identities through the half-twist. Opposing lanes
    // trade places while the body stays dark enough to see the ribbon and worm.
    vec3 base = mix(uColorA, uColorB, smoothstep(0.42, 0.58, y));
    base = mix(base, vec3(0.62, 0.68, 0.78), 0.22);
    vec3 laneColor = mix(uColorA, uColorB, 0.5 + 0.5 * sin(twist));
    vec3 hot = mix(base, vec3(1.0, 0.97, 0.88), 0.3);
    vec2 circle = vec2(cos(angle), sin(angle));
    float cloud = noise3(vec3(circle * 2.0, y * 10.0 - uTime * 0.30));
    float filaments = pow(1.0 - abs(noise3(vec3(circle * 5.0, y * 5.0 - uTime * 0.75)) * 2.0 - 1.0), 14.0);

    // Broken hoops read as depth stations, leaving open windows between them.
    // Derivative smoothing keeps the distant lines stable on phone displays.
    float hoopDistance = abs(fract(y * 14.0 - uTime * 0.16) - 0.5);
    float aa = max(fwidth(y) * 14.0, 0.012);
    float hoop = 1.0 - smoothstep(0.05, 0.05 + aa, hoopDistance);
    float segments = smoothstep(-0.5, -0.1, cos(angle * 8.0 + y * 6.2831853));
    hoop *= segments;
    float helix = pow(0.5 + 0.5 * cos(twist * 2.0), 42.0);
    float packets = pow(0.5 + 0.5 * cos(y * 40.0 - uTime * 1.8), 10.0);

    float nearHead = exp(-pow((y - uHead) / 0.19, 2.0));
    float wake = step(y, uHead) * exp(-abs(uHead - y) * 6.0);
    float arrival = exp(-pow((y - uHead - 0.06) / 0.045, 2.0));
    // Sparse glints are shader detail, not a particle emitter or extra draw call.
    vec2 cell = vec2(vUv.x * 32.0, y * 45.0 - uTime * 0.45);
    vec2 local = fract(cell) - 0.5;
    float seed = hash13(vec3(floor(cell), 7.0));
    float glint = (1.0 - smoothstep(0.02, 0.13, length(local * vec2(1.0, 0.42)))) * step(0.91, seed);

    vec3 col = base * (0.32 + cloud * 0.24 + nearHead * 0.16);
    col += hot * hoop * (0.50 + nearHead * 0.30);
    col += laneColor * helix * (0.55 + packets * 0.5 + wake * 0.25);
    col += hot * filaments * (0.26 + nearHead * 0.20);
    col += hot * arrival * hoop * 0.65;
    col += mix(base, vec3(1.0), 0.7) * glint * 0.75;

    // A braided color bridge replaces the broad white midpoint wash. Its
    // angular gaps preserve the core silhouette during the orientation change.
    float seam = (1.0 - smoothstep(0.0, 0.13, coreDistance));
    float braid = pow(0.5 + 0.5 * cos(twist * 2.0 - y * 20.0), 8.0);
    col = col * mix(0.65, 1.0, coreFade) + mix(laneColor, hot, 0.25) * seam * (0.22 + braid * 0.65);
    float wall = (0.52 + cloud * 0.10 + hoop * 0.18 + helix * 0.14 + filaments * 0.08 + glint * 0.10) * mix(0.8, 1.0, coreFade);
    float bridge = seam * (0.10 + braid * 0.30);
    gl_FragColor = vec4(col, min(0.86, (wall + bridge) * mouth * uOpacity));
    #include <colorspace_fragment>
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

export function TunnelTube({ worm, size }) {
  const meshRef = useRef();
  const opacityRef = useRef(0);
  const builtForRef = useRef(null);
  const lastTunnelRef = useRef(null);

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

      const r = tunnelBoreRadiusAt(t);
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
    const tailPassage = worm.tunnelPassages?.current?.at(-1);
    const occupyingTunnel = worm.activeTunnel.current ?? tailPassage?.tunnel;
    if (occupyingTunnel) lastTunnelRef.current = occupyingTunnel;
    const tunnel = occupyingTunnel ?? lastTunnelRef.current;
    const riding = phase === 'tunnel' || phase === 'exiting';
    const entering = phase === 'entering';

    // Same easing the camera dives on (WormChaseCamera), so wall strength and
    // approach speed are the same curve.
    const enterP = Math.min(1, Math.max(0, worm.tunnelProgress.current ?? 0));
    const dive = diveProgress(enterP);
    const target = entering ? OP_ENTER + (OP_RIDE - OP_ENTER) * dive : (riding || tailPassage) ? OP_RIDE
      : phase === 'windout' ? OP_ENTER : 0;
    const lerp = target > opacityRef.current ? OP_LERP_IN : OP_LERP_OUT;
    opacityRef.current += (target - opacityRef.current) * Math.min(1, delta * lerp);

    const st = useGameStore.getState();
    if (!st.wormPaused && st.wormAlive && !prefersReducedMotion()) uniforms.uTime.value += Math.min(delta, 0.05);
    uniforms.uOpacity.value = opacityRef.current;

    if (!meshRef.current) return;
    if (!tunnel || opacityRef.current < 0.01) {
      meshRef.current.visible = false;
      builtForRef.current = null;
      return;
    }
    meshRef.current.visible = true;

    const key = `${size}:${tunnel.entry.x},${tunnel.entry.y},${tunnel.entry.z},${tunnel.entry.dirKey}:${tunnel.exit.x},${tunnel.exit.y},${tunnel.exit.z},${tunnel.exit.dirKey}`;
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
        : phase === 'entering' ? tp * 0.33 : 1;
  });

  return (
    // Positions are written in world space, so culling against the stale
    // bounding sphere would pop the tube out of view.
    <mesh ref={meshRef} geometry={geo} frustumCulled={false} renderOrder={2}>
      <shaderMaterial
        uniforms={uniforms}
        extensions={{ derivatives: true }}
        toneMapped={false}
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
