import React, { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useGameStore, selectEffectiveFlipCap } from '../../hooks/useGameStore.js';
import { WORM_CAUTION_POLE_HEIGHT, WORM_CAUTION_TAPE_TOP } from '../../game/raisedCubie.js';
import { wormExpansion } from '../wormExpansion.js';
import { liveRotation, liveLayerAngle } from '../liveRotation.js';
import { buildCautionPerimeter, cautionPointInto } from './cautionPerimeter.js';

const dummy = new THREE.Object3D(), point = new THREE.Vector3();
const poleAxis = new THREE.Vector3(0, 1, 0), poleUp = new THREE.Vector3();
const rotationAxis = new THREE.Vector3();
const TAPE_WIDTH = 0.12;

export default function RaisedCautionPerimeter({ positions, cubies, size, texture, rotationEpoch = useGameStore.getState().rotationEpoch }) {
  const poles = useRef();
  const lastExpansion = useRef(NaN);
  const motion = useRef({ active: false, txn: -1, layouts: null, perimeter: null });
  const cap = useGameStore(selectEffectiveFlipCap);
  const layouts = useMemo(() => [
    buildCautionPerimeter(positions, cubies, size, cap),
    buildCautionPerimeter(positions, cubies, size, cap, true),
  ], [positions, cubies, size, cap]);
  const capacity = Math.max(...layouts.map(p => p.edges.length));
  const poleCapacity = Math.max(1, ...layouts.map(p => p.posts.length));
  const geometry = useMemo(() => {
    const g = new THREE.BufferGeometry();
    const uv = [], indices = [];
    for (let i = 0; i < capacity; i++) {
      uv.push(0, 1, 0, 0, 1, 1, 1, 0);
      const j = i * 4;
      indices.push(j, j + 1, j + 2, j + 1, j + 3, j + 2);
    }
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(capacity * 12), 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(indices);
    return g;
  }, [capacity]);
  useEffect(() => { lastExpansion.current = NaN; }, [layouts, geometry]);
  useEffect(() => () => geometry.dispose(), [geometry]);

  useFrame(() => {
    const expansion = wormExpansion.amount;
    // Keep the last posed fence until React supplies the committed coordinates;
    // applying the cleared bridge to old grid data would snap it backwards.
    if (!poles.current || rotationEpoch !== useGameStore.getState().rotationEpoch) return;
    const rotating = liveRotation.active;
    if (!rotating && !motion.current.active && lastExpansion.current === expansion) return;
    lastExpansion.current = expansion;
    motion.current.active = rotating;
    let perimeter = layouts[expansion > 0 ? 1 : 0];
    if (rotating) {
      rotationAxis.set(liveRotation.axis === 'col' ? 1 : 0, liveRotation.axis === 'row' ? 1 : 0, liveRotation.axis === 'depth' ? 1 : 0);
      if (expansion === 0) {
        if (motion.current.txn !== liveRotation.txnId || motion.current.layouts !== layouts) {
          motion.current.txn = liveRotation.txnId;
          motion.current.layouts = layouts;
          motion.current.perimeter = buildCautionPerimeter(positions, cubies, size, cap, false, liveRotation);
        }
        perimeter = motion.current.perimeter;
      }
    }
    perimeter.posts.forEach((vertex, index) => {
      cautionPointInto(dummy.position, vertex, size, expansion, 0.01 + WORM_CAUTION_POLE_HEIGHT / 2);
      poleUp.copy(vertex.up).normalize();
      const angle = liveLayerAngle(...vertex.center);
      if (angle !== null) {
        dummy.position.applyAxisAngle(rotationAxis, angle);
        poleUp.applyAxisAngle(rotationAxis, angle);
      }
      dummy.quaternion.setFromUnitVectors(poleAxis, poleUp);
      dummy.scale.set(1, WORM_CAUTION_POLE_HEIGHT * vertex.up.length(), 1);
      dummy.updateMatrix();
      poles.current.setMatrixAt(index, dummy.matrix);
    });
    poles.current.count = perimeter.posts.length;
    poles.current.instanceMatrix.needsUpdate = true;
    const attribute = geometry.attributes.position;
    perimeter.edges.forEach(({ a, b }, index) => {
      // Top and bottom corners are shared across faces, including the bend in
      // the tape. A rectangular instance would leave triangular gaps there.
      for (let j = 0; j < 4; j++) {
        cautionPointInto(point, j < 2 ? a : b, size, expansion, WORM_CAUTION_TAPE_TOP - (j % 2) * TAPE_WIDTH);
        const angle = liveLayerAngle(...(j < 2 ? a : b).center);
        if (angle !== null) point.applyAxisAngle(rotationAxis, angle);
        attribute.setXYZ(index * 4 + j, point.x, point.y, point.z);
      }
    });
    geometry.setDrawRange(0, perimeter.edges.length * 6);
    attribute.needsUpdate = true;
  });

  return <group>
    <instancedMesh name="worm-caution-poles" ref={poles} count={0}
      args={[undefined, undefined, poleCapacity]} frustumCulled={false}>
      <cylinderGeometry args={[0.018, 0.018, 1, 6]} />
      <meshBasicMaterial color="#111111" />
    </instancedMesh>
    <mesh name="worm-caution-tape" geometry={geometry} frustumCulled={false}>
      <meshBasicMaterial map={texture} color="#ffffff" side={THREE.DoubleSide} toneMapped={false} />
    </mesh>
  </group>;
}
