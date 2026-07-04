import React, { useRef, useImperativeHandle } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

const RING_DURATION = 0.35;
const _torusGeo = new THREE.TorusGeometry(0.1, 0.015, 8, 32);
const _ringColor = new THREE.Color();

const FlipShockwaveRing = React.forwardRef((_props, ref) => {
  const meshRef = useRef();
  const matRef = useRef();
  const activeRef = useRef(false);
  const startTimeRef = useRef(0);
  const normalRef = useRef(new THREE.Vector3(0, 0, 1));
  const colorRef = useRef('#ffffff');

  useImperativeHandle(ref, () => ({
    trigger(normal, color, clock) {
      activeRef.current = true;
      startTimeRef.current = clock.getElapsedTime();
      normalRef.current.copy(normal);
      colorRef.current = color;
      if (matRef.current) {
        _ringColor.set(color).lerp(new THREE.Color('#ffffff'), 0.4);
        matRef.current.color.copy(_ringColor);
        matRef.current.emissive.copy(_ringColor);
      }
      if (meshRef.current) {
        meshRef.current.quaternion.setFromUnitVectors(
          new THREE.Vector3(0, 0, 1),
          normalRef.current
        );
      }
    }
  }));

  useFrame(({ clock }) => {
    const mesh = meshRef.current;
    if (!mesh || !activeRef.current) {
      if (mesh) mesh.visible = false;
      return;
    }

    const elapsed = clock.getElapsedTime() - startTimeRef.current;
    if (elapsed > RING_DURATION) {
      activeRef.current = false;
      mesh.visible = false;
      return;
    }

    mesh.visible = true;
    const t = elapsed / RING_DURATION;
    const scale = 0.5 + t * 5.0;
    const fade = 1 - t * t;
    mesh.scale.set(scale, scale, 1);
    if (matRef.current) {
      matRef.current.opacity = fade * 0.6;
      matRef.current.emissiveIntensity = fade * 1.5;
    }
  });

  return (
    <mesh ref={meshRef} geometry={_torusGeo} visible={false} renderOrder={15}>
      <meshStandardMaterial
        ref={matRef}
        color="#ffffff"
        emissive="#ffffff"
        emissiveIntensity={1.5}
        transparent
        opacity={0}
        depthWrite={false}
        side={THREE.DoubleSide}
        blending={THREE.AdditiveBlending}
      />
    </mesh>
  );
});

export default FlipShockwaveRing;
