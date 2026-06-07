import { useRef, useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { FLIP_CAP } from '../utils/constants.js';

const FACE_NORM_LOCAL = {
  PX: [1, 0, 0], NX: [-1, 0, 0],
  PY: [0, 1, 0], NY: [0, -1, 0],
  PZ: [0, 0, 1], NZ: [0, 0, -1],
};

const FACE_OFFSET = 0.52;
const RIBBON_WIDTH = 0.85;
const RIBBON_SEGS = 32; // must be even — half goes to mini-cube face, half from it
const REBUILD_EPS_SQ = 1e-4;

// Radius from cube centre to the AntipodalMinicube sticker face — must match MINI_S in VoidCore.jsx.
const MINI_FACE_R = 0.25;

// Module-level cached objects — no per-frame allocation.
const _wPos1 = new THREE.Vector3();
const _wPos2 = new THREE.Vector3();
const _wQuat1 = new THREE.Quaternion();
const _wQuat2 = new THREE.Quaternion();
const _faceNorm1 = new THREE.Vector3();
const _faceNorm2 = new THREE.Vector3();
const _vStart = new THREE.Vector3();
const _vEnd = new THREE.Vector3();
const _midA = new THREE.Vector3();
const _midB = new THREE.Vector3();
const _axis = new THREE.Vector3();
const _perpBase = new THREE.Vector3();
const _perpCurrent = new THREE.Vector3();
const _up = new THREE.Vector3(0, 1, 0);
const _side = new THREE.Vector3(0, 0, 1);

// Vertex shader: pass UV to fragment.
const vertexShader = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

// Fragment shader: color each arm of the band to match the spiral color on its tile.
// vUv.y runs 0→1 along the ribbon (tile-1 end → tile-2 end), so the first arm shows
// colorA (tile 1's face color) and the second arm shows colorB (tile 2's face color),
// with a smooth blend at the centre where the band passes through the mini-cube.
const fragmentShader = `
  uniform vec3 uColorA;
  uniform vec3 uColorB;
  uniform float uOpacity;
  varying vec2 vUv;

  void main() {
    float blend = smoothstep(0.38, 0.62, vUv.y);
    vec3 col = mix(uColorA, uColorB, blend);
    float edgeFade = smoothstep(0.0, 0.14, vUv.x) * smoothstep(1.0, 0.86, vUv.x);
    gl_FragColor = vec4(col, uOpacity * mix(0.5, 1.0, edgeFade));
  }
`;

/**
 * Fill position + UV buffers for a Möbius ribbon that routes through the
 * AntipodalMinicube at the cube's centre.
 *
 * Path (piecewise, two visible segments):
 *   Segment 1  t∈[0, 0.5]: startPos → midAPos (mini-cube face A surface)
 *   Segment 2  t∈[0.5, 1]: midBPos (mini-cube face B surface) → endPos
 *
 * The mini-cube body occludes everything between midA and midB, so the ribbon
 * appears to enter the mini-cube on one face and exit the antipodal face.
 * The Möbius half-twist is distributed continuously over all t, so the
 * edge-on transition (t=0.5, the natural "pinch" of the twist) lands exactly
 * at the hidden interior — the two visible arcs each show a clean 90° arc of
 * solid ribbon with no apparent split.
 */
// Minimum width multiplier at the centre (t=0.5): the band tapers to this fraction
// of its full width as it funnels into the AntipodalMinicube at the cube's heart.
const TAPER_MIN = 0.15;

function fillRibbon(posArray, uvArray, startPos, midAPos, midBPos, endPos, axis, perpStart, segs, width) {
  const halfW = width / 2;
  const halfSegs = segs / 2; // segs is always even (32)

  for (let i = 0; i <= segs; i++) {
    const t = i / segs; // twist parameter: 0 → 1

    // Taper: full width at each tile end (t=0, t=1), narrowest at the mini-cube (t=0.5).
    // Math.abs(2t-1) is 1 at the ends and 0 at the centre.
    const taper = TAPER_MIN + (1.0 - TAPER_MIN) * Math.abs(2.0 * t - 1.0);
    const w = halfW * taper;

    // Piecewise centre-line position
    let cx, cy, cz;
    if (i <= halfSegs) {
      // First arc: sticker A → mini-cube face A
      const s = i / halfSegs;
      cx = startPos.x + (midAPos.x - startPos.x) * s;
      cy = startPos.y + (midAPos.y - startPos.y) * s;
      cz = startPos.z + (midAPos.z - startPos.z) * s;
    } else {
      // Second arc: mini-cube face B → sticker B
      const s = (i - halfSegs) / halfSegs;
      cx = midBPos.x + (endPos.x - midBPos.x) * s;
      cy = midBPos.y + (endPos.y - midBPos.y) * s;
      cz = midBPos.z + (endPos.z - midBPos.z) * s;
    }

    // Möbius half-twist: cross-section direction rotates π over the full t range
    _perpCurrent.copy(perpStart).applyAxisAngle(axis, t * Math.PI);

    for (let side = 0; side < 2; side++) {
      const sign = side === 0 ? -w : w;
      const vi = (i * 2 + side) * 3;
      posArray[vi]     = cx + _perpCurrent.x * sign;
      posArray[vi + 1] = cy + _perpCurrent.y * sign;
      posArray[vi + 2] = cz + _perpCurrent.z * sign;

      const ui = (i * 2 + side) * 2;
      uvArray[ui]     = side; // 0 or 1 across the width
      uvArray[ui + 1] = t;    // 0 → 1 along the length
    }
  }
}

function createRibbonGeo(segs) {
  const vertCount = (segs + 1) * 2;
  const posArray = new Float32Array(vertCount * 3);
  const uvArray  = new Float32Array(vertCount * 2);

  // Quad triangles connecting adjacent cross-sections.
  // Skip i === segs/2: that quad would bridge midA → midB (inside the mini-cube body).
  const indices = [];
  for (let i = 0; i < segs; i++) {
    if (i === segs / 2) continue; // gap hidden by mini-cube body
    const a = i * 2;
    const b = a + 1;
    const c = a + 2;
    const d = a + 3;
    indices.push(a, b, c, b, d, c);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(posArray, 3));
  geo.setAttribute('uv',       new THREE.BufferAttribute(uvArray,  2));
  geo.setIndex(indices);
  return geo;
}

/**
 * MobiusTunnel — one Möbius ribbon per active antipodal sticker pair.
 * Props are compatible with the old WormholeTunnel for a drop-in swap.
 */
const MobiusTunnel = ({
  meshIdx1,
  meshIdx2,
  dirKey1,
  dirKey2,
  cubieRefs,
  flips,
  color1,
  color2,
}) => {
  const meshRef = useRef();
  const pulseT  = useRef(Math.random() * Math.PI * 2);
  const lastStartRef = useRef(new THREE.Vector3(Infinity, Infinity, Infinity));
  const lastEndRef   = useRef(new THREE.Vector3(Infinity, Infinity, Infinity));

  const geo = useMemo(() => createRibbonGeo(RIBBON_SEGS), []);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const uniforms = useMemo(() => ({
    uColorA: { value: new THREE.Color(color1) },
    uColorB: { value: new THREE.Color(color2) },
    uOpacity: { value: 0.80 },
  }), []); // created once; synced imperatively below

  useEffect(() => {
    const g = geo;
    return () => g.dispose();
  }, [geo]);

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

    // Ribbon anchors: just inside each sticker tile's back surface
    _vStart.copy(_wPos1).addScaledVector(_faceNorm1, -FACE_OFFSET);
    _vEnd  .copy(_wPos2).addScaledVector(_faceNorm2, -FACE_OFFSET);

    // Mini-cube face docking points in world space.
    // The mini-cube centre is always at world origin (cube group is centred there).
    // Its face A sits at faceNorm1 * MINI_FACE_R, face B at faceNorm2 * MINI_FACE_R.
    _midA.copy(_faceNorm1).multiplyScalar(MINI_FACE_R);
    _midB.copy(_faceNorm2).multiplyScalar(MINI_FACE_R);

    const moved =
      lastStartRef.current.distanceToSquared(_vStart) > REBUILD_EPS_SQ ||
      lastEndRef  .current.distanceToSquared(_vEnd)   > REBUILD_EPS_SQ;

    if (moved) {
      lastStartRef.current.copy(_vStart);
      lastEndRef  .current.copy(_vEnd);

      // Twist axis: overall start-to-end direction
      _axis.subVectors(_vEnd, _vStart).normalize();

      // Initial cross-section direction: cross the ribbon axis with tile 1's face normal.
      // This yields a vector that is both perpendicular to the ribbon axis (valid as a
      // cross-section direction) AND tangent to the tile face — so the band lays flush
      // against side tiles instead of cutting through them at an arbitrary angle.
      // Degenerates when the ribbon runs exactly perpendicular to the face (direct
      // face-to-centre connections); fall back to world-up / world-side in that case.
      _perpBase.crossVectors(_axis, _faceNorm1);
      if (_perpBase.lengthSq() < 0.001) _perpBase.crossVectors(_axis, _up);
      if (_perpBase.lengthSq() < 0.001) _perpBase.crossVectors(_axis, _side);
      _perpBase.normalize();

      const dead = flips >= FLIP_CAP;
      uniforms.uColorA.value.set(dead ? '#555555' : color1);
      uniforms.uColorB.value.set(dead ? '#444444' : color2);

      fillRibbon(
        geo.attributes.position.array,
        geo.attributes.uv.array,
        _vStart, _midA, _midB, _vEnd,
        _axis, _perpBase,
        RIBBON_SEGS, RIBBON_WIDTH
      );

      geo.attributes.position.needsUpdate = true;
      geo.attributes.uv.needsUpdate = true;
    }

    // Subtle opacity pulse — no geometry rebuild
    pulseT.current += delta * 1.5;
    uniforms.uOpacity.value = 0.72 + Math.sin(pulseT.current) * 0.08;
  });

  return (
    <mesh ref={meshRef} geometry={geo}>
      <shaderMaterial
        uniforms={uniforms}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        side={THREE.DoubleSide}
        transparent
        depthWrite={false}
      />
    </mesh>
  );
};

export default MobiusTunnel;
