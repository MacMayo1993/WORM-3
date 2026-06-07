import { useRef, useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { FLIP_CAP } from '../utils/constants.js';

const FACE_NORM_LOCAL = {
  PX: [1, 0, 0], NX: [-1, 0, 0],
  PY: [0, 1, 0], NY: [0, -1, 0],
  PZ: [0, 0, 1], NZ: [0, 0, -1],
};

// Distance inward from cubie center to ribbon anchor — matches WormholeTunnel.
const FACE_OFFSET = 0.52;

// Ribbon width matches the sticker plane size in StickerPlane.jsx.
const RIBBON_WIDTH = 0.85;

// Segments along the ribbon's length. 32 gives a smooth twist with minimal vertex count.
const RIBBON_SEGS = 32;

// Only rebuild geometry when a cubie moves more than this distance² from its last known position.
const REBUILD_EPS_SQ = 1e-4;

// Module-level cached objects — no per-frame allocation (same pattern as WormholeTunnel).
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
const _c1 = new THREE.Color();
const _c2 = new THREE.Color();
const _cBlend = new THREE.Color();

/**
 * Fill a pre-allocated position + color buffer with Möbius ribbon vertices.
 *
 * The ribbon has `segs` cross-sections along a straight line from startPos to endPos.
 * Each cross-section is a segment of length `width` perpendicular to the axis.
 * The perpendicular direction rotates by π (half-twist) over the full length —
 * this is the defining property of a Möbius strip. The two edges of the ribbon
 * naturally arc above and below the midpoint when viewed from the side, giving the
 * "full Möbius loop" silhouette described in the design.
 *
 * Colors blend smoothly from colorA at t=0 to colorB at t=1 so that each face's
 * colour flows into the band from its attachment point.
 */
function fillRibbon(posArray, colorArray, startPos, endPos, axis, perpStart, colorA, colorB, segs, width) {
  _c1.set(colorA);
  _c2.set(colorB);
  const halfW = width / 2;

  for (let i = 0; i <= segs; i++) {
    const t = i / segs;

    // Center-line position (straight lerp from start to end)
    const cx = startPos.x + (endPos.x - startPos.x) * t;
    const cy = startPos.y + (endPos.y - startPos.y) * t;
    const cz = startPos.z + (endPos.z - startPos.z) * t;

    // Möbius half-twist: perpendicular rotates π radians over the full length
    _perpCurrent.copy(perpStart).applyAxisAngle(axis, t * Math.PI);

    // Color: face A blends into face B
    _cBlend.lerpColors(_c1, _c2, t);

    // Two vertices per cross-section (the two edges of the strip)
    for (let side = 0; side < 2; side++) {
      const sign = side === 0 ? -halfW : halfW;
      const vi = (i * 2 + side) * 3;
      posArray[vi] = cx + _perpCurrent.x * sign;
      posArray[vi + 1] = cy + _perpCurrent.y * sign;
      posArray[vi + 2] = cz + _perpCurrent.z * sign;
      colorArray[vi] = _cBlend.r;
      colorArray[vi + 1] = _cBlend.g;
      colorArray[vi + 2] = _cBlend.b;
    }
  }
}

/** Create a ribbon BufferGeometry with pre-allocated position + color buffers. */
function createRibbonGeo(segs) {
  const vertCount = (segs + 1) * 2;
  const posArray = new Float32Array(vertCount * 3);
  const colorArray = new Float32Array(vertCount * 3);

  // Quad grid of triangles connecting adjacent cross-sections
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
  geo.setAttribute('color', new THREE.BufferAttribute(colorArray, 3));
  geo.setIndex(indices);
  return geo;
}

/**
 * MobiusTunnel — renders a single Möbius ribbon connecting an antipodal sticker pair.
 *
 * Props match WormholeTunnel so WormholeNetwork only needs a one-line import swap.
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
  const matRef = useRef();
  const pulseT = useRef(Math.random() * Math.PI * 2);
  const lastStartRef = useRef(new THREE.Vector3(Infinity, Infinity, Infinity));
  const lastEndRef = useRef(new THREE.Vector3(Infinity, Infinity, Infinity));

  const geo = useMemo(() => createRibbonGeo(RIBBON_SEGS), []);

  useEffect(() => {
    const g = geo;
    return () => g.dispose();
  }, [geo]);

  useFrame((_state, delta) => {
    const mesh1 = cubieRefs[meshIdx1];
    const mesh2 = cubieRefs[meshIdx2];
    if (!mesh1 || !mesh2 || !meshRef.current) return;

    // Get cubie world transforms (same pattern as WormholeTunnel)
    mesh1.getWorldPosition(_wPos1);
    mesh1.getWorldQuaternion(_wQuat1);
    mesh2.getWorldPosition(_wPos2);
    mesh2.getWorldQuaternion(_wQuat2);

    const n1 = FACE_NORM_LOCAL[dirKey1];
    const n2 = FACE_NORM_LOCAL[dirKey2];
    _faceNorm1.set(n1[0], n1[1], n1[2]).applyQuaternion(_wQuat1);
    _faceNorm2.set(n2[0], n2[1], n2[2]).applyQuaternion(_wQuat2);

    // Anchor points: just inside each sticker tile's back surface
    _vStart.copy(_wPos1).addScaledVector(_faceNorm1, -FACE_OFFSET);
    _vEnd.copy(_wPos2).addScaledVector(_faceNorm2, -FACE_OFFSET);

    // Rebuild geometry only when cubie positions have changed meaningfully
    const moved =
      lastStartRef.current.distanceToSquared(_vStart) > REBUILD_EPS_SQ ||
      lastEndRef.current.distanceToSquared(_vEnd) > REBUILD_EPS_SQ;

    if (moved) {
      lastStartRef.current.copy(_vStart);
      lastEndRef.current.copy(_vEnd);

      // Axis direction along the ribbon's length
      _axis.subVectors(_vEnd, _vStart).normalize();

      // Initial cross-section direction (perpendicular to axis at t=0)
      // Cross product with world-up; fall back to world-side if axis is parallel to up.
      _perpBase.crossVectors(_axis, _up);
      if (_perpBase.lengthSq() < 0.001) {
        _perpBase.crossVectors(_axis, _side);
      }
      _perpBase.normalize();

      const dead = flips >= FLIP_CAP;
      const c1 = dead ? '#555555' : color1;
      const c2 = dead ? '#444444' : color2;

      fillRibbon(
        geo.attributes.position.array,
        geo.attributes.color.array,
        _vStart, _vEnd, _axis, _perpBase,
        c1, c2,
        RIBBON_SEGS, RIBBON_WIDTH
      );

      geo.attributes.position.needsUpdate = true;
      geo.attributes.color.needsUpdate = true;
      geo.computeVertexNormals();
    }

    // Subtle opacity pulse — uniform update only, no geometry rebuild
    pulseT.current += delta * 1.5;
    if (matRef.current) {
      matRef.current.opacity = 0.72 + Math.sin(pulseT.current) * 0.08;
    }
  });

  return (
    <mesh ref={meshRef} geometry={geo}>
      <meshStandardMaterial
        ref={matRef}
        vertexColors
        side={THREE.DoubleSide}
        transparent
        opacity={0.80}
        depthWrite={false}
        roughness={0.35}
        metalness={0.1}
      />
    </mesh>
  );
};

export default MobiusTunnel;
