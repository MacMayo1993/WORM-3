import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useGameStore } from '../hooks/useGameStore.js';
import { getStickerWorldPos } from '../game/gridIds.js';
import { FACE_COLORS, ANTIPODAL_COLOR } from '../utils/constants.js';

const DIR_ROTATIONS = {
  PX: [0, Math.PI / 2, 0],
  NX: [0, -Math.PI / 2, 0],
  PY: [-Math.PI / 2, 0, 0],
  NY: [Math.PI / 2, 0, 0],
  PZ: [0, 0, 0],
  NZ: [0, Math.PI, 0],
};

const _sharedRingGeo = new THREE.RingGeometry(0.38, 0.52, 24);
const _sharedDiscGeo = new THREE.CircleGeometry(0.42, 24);

const HighlightRing = ({ position, rotation, color }) => {
  const ringRef = useRef();
  const discRef = useRef();
  const ringMat = useMemo(() => new THREE.MeshBasicMaterial({
    color, transparent: true, opacity: 0,
    blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
  }), [color]);
  const discMat = useMemo(() => new THREE.MeshBasicMaterial({
    color, transparent: true, opacity: 0,
    blending: THREE.AdditiveBlending, depthWrite: false,
  }), [color]);

  useFrame(() => {
    if (!ringRef.current) return;
    const t = performance.now() / 1000;
    const pulse = Math.sin(t * 4) * 0.5 + 0.5;
    const breathe = 0.95 + pulse * 0.15;
    ringRef.current.scale.set(breathe, breathe, 1);
    ringMat.opacity = 0.5 + pulse * 0.4;
    discMat.opacity = 0.08 + pulse * 0.12;
  });

  return (
    <group position={position} rotation={rotation}>
      <mesh ref={ringRef} geometry={_sharedRingGeo} material={ringMat} />
      <mesh ref={discRef} geometry={_sharedDiscGeo} material={discMat} position={[0, 0, -0.001]} />
    </group>
  );
};

const TetherLine = ({ from, to, color }) => {
  const lineRef = useRef();
  const mat = useMemo(() => new THREE.LineBasicMaterial({
    color, transparent: true, opacity: 0.35,
    blending: THREE.AdditiveBlending, depthWrite: false,
  }), [color]);

  const geo = useMemo(() => {
    const points = [];
    const a = new THREE.Vector3(...from);
    const b = new THREE.Vector3(...to);
    const steps = 20;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const p = new THREE.Vector3().lerpVectors(a, b, t);
      const bulge = Math.sin(t * Math.PI) * 0.3;
      p.y += bulge;
      points.push(p);
    }
    return new THREE.BufferGeometry().setFromPoints(points);
  }, [from, to]);

  useFrame(() => {
    if (!lineRef.current) return;
    const t = performance.now() / 1000;
    mat.opacity = 0.2 + Math.sin(t * 3) * 0.15;
  });

  return <line ref={lineRef} geometry={geo} material={mat} />;
};

const AntipodalPairHighlight = () => {
  const pair = useGameStore((s) => s.firstFlipHighlightPair);
  const size = useGameStore((s) => s.size);

  if (!pair) return null;

  const srcPos = getStickerWorldPos(pair.source.x, pair.source.y, pair.source.z, pair.source.dir, size);
  const antPos = getStickerWorldPos(pair.antipodal.x, pair.antipodal.y, pair.antipodal.z, pair.antipodal.dir, size);
  const srcRot = DIR_ROTATIONS[pair.source.dir] || [0, 0, 0];
  const antRot = DIR_ROTATIONS[pair.antipodal.dir] || [0, 0, 0];
  const srcColor = FACE_COLORS[pair.source.faceId] || '#3b82f6';
  const antColor = FACE_COLORS[pair.antipodal.faceId] || '#f97316';

  return (
    <group>
      <HighlightRing position={srcPos} rotation={srcRot} color={srcColor} />
      <HighlightRing position={antPos} rotation={antRot} color={antColor} />
      <TetherLine from={srcPos} to={antPos} color="#ffffff" />
    </group>
  );
};

export default AntipodalPairHighlight;
