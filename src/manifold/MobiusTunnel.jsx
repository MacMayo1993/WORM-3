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
const RIBBON_SEGS = 32;
const REBUILD_EPS_SQ = 1e-4;

// Module-level cached objects — no per-frame allocation.
const _wPos1 = new THREE.Vector3();
const _wPos2 = new THREE.Vector3();
const _wQuat1 = new THREE.Quaternion();
const _wQuat2 = new THREE.Quaternion();
const _faceNorm1 = new THREE.Vector3();
const _faceNorm2 = new THREE.Vector3();
const _vStart = new THREE.Vector3();
const _vEnd = new THREE.Vector3();
const _axis = new THREE.Vector3();
const _perpBase = new THREE.Vector3();
const _perpCurrent = new THREE.Vector3();
const _up = new THREE.Vector3(0, 1, 0);
const _side = new THREE.Vector3(0, 0, 1);

// Vertex shader: pass UV coords to fragment stage.
const vertexShader = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

// Fragment shader: gl_FrontFacing picks which colour to show on each rendered face.
//
// Because the ribbon has a half-twist (π rotation), the polygon faces that are
// "front" at one end are "back" at the other — so uColorB appears near face A
// and uColorA appears near face B. This visually encodes the RP2 identification:
// stepping through face A brings you out at face B showing face A's colour.
const fragmentShader = `
  uniform vec3 uColorA;
  uniform vec3 uColorB;
  uniform float uOpacity;
  varying vec2 vUv;

  void main() {
    // Front face shows the antipodal colour; back face shows this face's colour.
    // The Möbius half-twist swaps which is which at each endpoint.
    vec3 col = gl_FrontFacing ? uColorB : uColorA;

    // Soft fade at the long edges for a ribbon silhouette
    float edgeFade = smoothstep(0.0, 0.14, vUv.x) * smoothstep(1.0, 0.86, vUv.x);

    gl_FragColor = vec4(col, uOpacity * mix(0.5, 1.0, edgeFade));
  }
`;

/** Fill position + UV buffers for a half-twisted ribbon from startPos to endPos. */
function fillRibbon(posArray, uvArray, startPos, endPos, axis, perpStart, segs, width) {
  const halfW = width / 2;

  for (let i = 0; i <= segs; i++) {
    const t = i / segs;

    const cx = startPos.x + (endPos.x - startPos.x) * t;
    const cy = startPos.y + (endPos.y - startPos.y) * t;
    const cz = startPos.z + (endPos.z - startPos.z) * t;

    // Möbius half-twist: cross-section direction rotates π over the full length
    _perpCurrent.copy(perpStart).applyAxisAngle(axis, t * Math.PI);

    for (let side = 0; side < 2; side++) {
      const sign = side === 0 ? -halfW : halfW;
      const vi = (i * 2 + side) * 3;
      posArray[vi]     = cx + _perpCurrent.x * sign;
      posArray[vi + 1] = cy + _perpCurrent.y * sign;
      posArray[vi + 2] = cz + _perpCurrent.z * sign;

      const ui = (i * 2 + side) * 2;
      uvArray[ui]     = side; // 0 or 1 across the width
      uvArray[ui + 1] = t;    // 0→1 along the length
    }
  }
}

function createRibbonGeo(segs) {
  const vertCount = (segs + 1) * 2;
  const posArray = new Float32Array(vertCount * 3);
  const uvArray = new Float32Array(vertCount * 2);

  const indices = [];
  for (let i = 0; i < segs; i++) {
    const a = i * 2;
    const b = a + 1;
    const c = a + 2;
    const d = a + 3;
    indices.push(a, b, c, b, d, c);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(posArray, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uvArray, 2));
  geo.setIndex(indices);
  return geo;
}

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
  const pulseT = useRef(Math.random() * Math.PI * 2);
  const lastStartRef = useRef(new THREE.Vector3(Infinity, Infinity, Infinity));
  const lastEndRef = useRef(new THREE.Vector3(Infinity, Infinity, Infinity));

  const geo = useMemo(() => createRibbonGeo(RIBBON_SEGS), []);

  // Uniforms created once; color values updated imperatively in useFrame.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const uniforms = useMemo(() => ({
    uColorA: { value: new THREE.Color(color1) },
    uColorB: { value: new THREE.Color(color2) },
    uOpacity: { value: 0.80 },
  }), []); // intentionally empty deps — colour is synced below

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

    _vStart.copy(_wPos1).addScaledVector(_faceNorm1, -FACE_OFFSET);
    _vEnd.copy(_wPos2).addScaledVector(_faceNorm2, -FACE_OFFSET);

    const moved =
      lastStartRef.current.distanceToSquared(_vStart) > REBUILD_EPS_SQ ||
      lastEndRef.current.distanceToSquared(_vEnd) > REBUILD_EPS_SQ;

    if (moved) {
      lastStartRef.current.copy(_vStart);
      lastEndRef.current.copy(_vEnd);

      _axis.subVectors(_vEnd, _vStart).normalize();

      _perpBase.crossVectors(_axis, _up);
      if (_perpBase.lengthSq() < 0.001) {
        _perpBase.crossVectors(_axis, _side);
      }
      _perpBase.normalize();

      const dead = flips >= FLIP_CAP;
      uniforms.uColorA.value.set(dead ? '#555555' : color1);
      uniforms.uColorB.value.set(dead ? '#444444' : color2);

      fillRibbon(
        geo.attributes.position.array,
        geo.attributes.uv.array,
        _vStart, _vEnd, _axis, _perpBase,
        RIBBON_SEGS, RIBBON_WIDTH
      );

      geo.attributes.position.needsUpdate = true;
      geo.attributes.uv.needsUpdate = true;
    }

    // Subtle opacity pulse — uniform mutation only, no geometry rebuild
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
