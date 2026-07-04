import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useGameStore } from '../hooks/useGameStore.js';

const FLASH_DURATION = 0.25;

function buildSeamPoints(axis, sliceIndex, size) {
  const half = (size - 1) / 2;
  const lo = -half - 0.5;
  const hi = half + 0.5;
  const offset = sliceIndex - half;
  const pts = [];

  const addPlane = (coord) => {
    if (Math.abs(coord) > half + 0.501) return;
    const mk = (a, b) => {
      if (axis === 'col') return [coord, a, b];
      if (axis === 'row') return [a, coord, b];
      return [a, b, coord];
    };
    pts.push(...mk(lo, lo), ...mk(lo, hi), ...mk(lo, hi), ...mk(hi, hi));
    pts.push(...mk(hi, hi), ...mk(hi, lo), ...mk(hi, lo), ...mk(lo, lo));
    for (let j = 0; j < size - 1; j++) {
      const cross = j - half + 0.5;
      pts.push(...mk(cross, lo), ...mk(cross, hi));
      pts.push(...mk(lo, cross), ...mk(hi, cross));
    }
  };

  addPlane(offset - 0.5);
  addPlane(offset + 0.5);
  return new Float32Array(pts);
}

const SliceSnapFlash = ({ size }) => {
  const linesRef = useRef();
  const matRef = useRef();
  const flashRef = useRef({ active: false, startTime: 0 });
  const prevEpochRef = useRef(useGameStore.getState().rotationEpoch);

  useFrame(({ clock }) => {
    const lines = linesRef.current;
    if (!lines) return;

    const state = useGameStore.getState();
    const epoch = state.rotationEpoch;

    if (epoch !== prevEpochRef.current) {
      prevEpochRef.current = epoch;
      const lr = state.lastRotation;
      if (lr && !lr.isShuffle) {
        const pts = buildSeamPoints(lr.axis, lr.sliceIndex, size);
        const newArr = new Float32Array(Math.max(pts.length, 3));
        newArr.set(pts);
        lines.geometry.setAttribute('position', new THREE.BufferAttribute(newArr, 3));
        lines.geometry.setDrawRange(0, pts.length / 3);
        lines.geometry.computeBoundingSphere();
        flashRef.current = { active: true, startTime: clock.getElapsedTime() };
      }
    }

    if (!flashRef.current.active) {
      lines.visible = false;
      return;
    }

    const elapsed = clock.getElapsedTime() - flashRef.current.startTime;
    if (elapsed > FLASH_DURATION) {
      flashRef.current.active = false;
      lines.visible = false;
      return;
    }

    lines.visible = true;
    const t = elapsed / FLASH_DURATION;
    const fade = 1 - t * t;
    if (matRef.current) matRef.current.opacity = fade * 0.7;
  });

  return (
    <lineSegments ref={linesRef} visible={false} renderOrder={20}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={0}
          array={new Float32Array(600)}
          itemSize={3}
        />
      </bufferGeometry>
      <lineBasicMaterial
        ref={matRef}
        color="#ffffff"
        transparent
        opacity={0}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </lineSegments>
  );
};

export default SliceSnapFlash;
