import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

const SPARK_COUNT = 24;
const DURATION = 0.35;

const _v = new THREE.Vector3();

const TunnelSparkShower = ({ position, normal, color, startTime }) => {
  const pointsRef = useRef();
  const posArr = useMemo(() => new Float32Array(SPARK_COUNT * 3), []);
  const colArr = useMemo(() => new Float32Array(SPARK_COUNT * 3), []);

  const seeds = useMemo(() => {
    const s = [];
    for (let i = 0; i < SPARK_COUNT; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = (Math.random() - 0.5) * Math.PI * 0.7;
      const speed = 0.8 + Math.random() * 1.2;
      const drift = 0.6 + Math.random() * 0.4;
      s.push({ theta, phi, speed, drift });
    }
    return s;
  }, []);

  const baseColor = useMemo(() => new THREE.Color(color), [color]);
  const hotColor = useMemo(() => {
    const c = new THREE.Color(color);
    c.lerp(new THREE.Color('#ffffff'), 0.6);
    return c;
  }, [color]);

  useFrame(({ clock }) => {
    const pts = pointsRef.current;
    if (!pts) return;

    const elapsed = clock.getElapsedTime() - startTime;
    if (elapsed < 0 || elapsed > DURATION) {
      pts.visible = false;
      return;
    }

    pts.visible = true;
    const t = elapsed / DURATION;
    const fade = 1 - t * t;

    _v.set(...normal).normalize();
    const perp1 = new THREE.Vector3();
    const up = Math.abs(_v.y) < 0.8 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0);
    perp1.crossVectors(_v, up).normalize();
    const perp2 = new THREE.Vector3().crossVectors(_v, perp1).normalize();

    for (let i = 0; i < SPARK_COUNT; i++) {
      const s = seeds[i];
      const dist = t * s.speed * s.drift;

      const outward = dist * 0.5;
      const spread = dist * 0.8;
      const sx = Math.cos(s.theta) * Math.cos(s.phi) * spread;
      const sy = Math.sin(s.phi) * spread;
      const sz = Math.sin(s.theta) * Math.cos(s.phi) * spread;

      const i3 = i * 3;
      posArr[i3] = position[0] + _v.x * outward + perp1.x * sx + perp2.x * sy + sz * 0.3;
      posArr[i3 + 1] = position[1] + _v.y * outward + perp1.y * sx + perp2.y * sy;
      posArr[i3 + 2] = position[2] + _v.z * outward + perp1.z * sx + perp2.z * sz * 0.3;

      const sparkLife = 1 - (i / SPARK_COUNT) * 0.3;
      const brightness = fade * sparkLife;
      const c = i < SPARK_COUNT * 0.3 ? hotColor : baseColor;
      colArr[i3] = c.r * brightness;
      colArr[i3 + 1] = c.g * brightness;
      colArr[i3 + 2] = c.b * brightness;
    }

    pts.geometry.attributes.position.needsUpdate = true;
    pts.geometry.attributes.color.needsUpdate = true;
    pts.material.opacity = fade * 0.9;
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" count={SPARK_COUNT} array={posArr} itemSize={3} />
        <bufferAttribute attach="attributes-color" count={SPARK_COUNT} array={colArr} itemSize={3} />
      </bufferGeometry>
      <pointsMaterial
        size={0.04}
        transparent
        opacity={0.9}
        depthWrite={false}
        vertexColors
        blending={THREE.AdditiveBlending}
        sizeAttenuation
      />
    </points>
  );
};

export default TunnelSparkShower;
