// src/3d/CameraFlipKick.jsx
// Consumes the shared flipImpulse and micro-kicks the camera along the flipped
// tile's normal (a quick out-and-back recoil). To avoid fighting TrackballControls
// it pans the camera AND the controls target by the same decaying delta each frame,
// which leaves the orbit eye-vector untouched, so the controls neither drift nor
// snap back. Costs nothing while idle (impulse.t === 0 → zero-length delta).
import { useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { flipImpulse } from './flipImpulse.js';

const _target = new THREE.Vector3();
const _dO = new THREE.Vector3();

export default function CameraFlipKick({ controlsRef }) {
  const { camera } = useThree();
  const applied = useRef(new THREE.Vector3());

  useFrame((_state, delta) => {
    _target.set(0, 0, 0);
    if (flipImpulse.t > 0) {
      flipImpulse.t = Math.max(0, flipImpulse.t - delta);
      const u = 1 - flipImpulse.t / flipImpulse.dur; // 0 → 1 over the kick
      const env = Math.sin(u * Math.PI) * flipImpulse.strength; // smooth out-and-back
      _target.copy(flipImpulse.dir).multiplyScalar(env);
    }
    // Apply only the change vs last frame, to BOTH camera and target → rigid pan.
    _dO.copy(_target).sub(applied.current);
    if (_dO.lengthSq() > 1e-12) {
      camera.position.add(_dO);
      const tgt = controlsRef?.current?.target;
      if (tgt) tgt.add(_dO);
      applied.current.copy(_target);
    }
  });

  return null;
}
