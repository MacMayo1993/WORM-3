// src/3d/AntipodalGlowFill.jsx
// Antipodal glow fill — the crossing beat. An outer edge ring collapses inward
// while a bright core fills outward, reading as the tile being drawn through the
// manifold rather than merely recoloured. Sits under the shockwave, which throws
// its ring the other way; together they read as "pulled in, punched out".
//
// PASSIVE, like FlipShockwave/FlipFlash: this component owns no useFrame. Every
// sticker on the cube mounts one (150 of them on a 5×5), so a per-instance frame
// callback would be paid on every idle tile forever. Progress is driven by the
// parent StickerPlane tick, which only runs while the sticker is in the
// active-sticker registry. trigger() starts a burst; setProgress() advances it
// 0→1; at ≥1 the meshes hide so idle tiles skip the draw entirely.
import React, { useRef, useImperativeHandle } from 'react';
import * as THREE from 'three';

// Shared across every instance — no per-sticker geometry allocation.
const _sharedOuterRingGeometry = new THREE.RingGeometry(0.4, 0.5, 16);
const _sharedMainRingGeometry = new THREE.RingGeometry(0.2, 0.45, 16);
const _sharedInnerCircleGeometry = new THREE.CircleGeometry(0.48, 16);

const AntipodalGlowFill = React.forwardRef((_props, ref) => {
  const groupRef = useRef();
  const ringRef = useRef();
  const innerGlowRef = useRef();
  const outerRingRef = useRef();

  // Materials are per-instance (each tile fades on its own schedule) but are
  // created once and reused across every burst on this tile.
  const [outerMat] = React.useState(() => new THREE.MeshBasicMaterial({
    color: '#ffffff', transparent: true, opacity: 0,
    blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
  }));
  const [ringMat] = React.useState(() => new THREE.MeshBasicMaterial({
    color: '#ffffff', transparent: true, opacity: 0,
    blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
  }));
  const [innerMat] = React.useState(() => new THREE.MeshBasicMaterial({
    color: '#ffffff', transparent: true, opacity: 0,
    blending: THREE.AdditiveBlending, depthWrite: false,
  }));

  React.useEffect(() => () => {
    outerMat.dispose();
    ringMat.dispose();
    innerMat.dispose();
  }, [outerMat, ringMat, innerMat]);

  useImperativeHandle(ref, () => ({
    trigger(color) {
      if (color) {
        outerMat.color.set(color);
        ringMat.color.set(color);
        innerMat.color.set(color);
      }
      if (groupRef.current) groupRef.current.visible = true;
    },
    // Advanced 0→1 by the parent tick (active-registry driven); ≥1 = spent.
    setProgress(p) {
      if (p >= 1) {
        outerMat.opacity = 0;
        ringMat.opacity = 0;
        innerMat.opacity = 0;
        if (groupRef.current) groupRef.current.visible = false;
        return;
      }
      const snappy = 1 - Math.pow(1 - p, 3);

      // Main ring collapses inward, pulsing as it goes.
      if (ringRef.current) {
        const ringScale = Math.max(0.01, 1 - snappy);
        ringRef.current.scale.set(ringScale, ringScale, 1);
        const glowPulse = Math.sin(p * Math.PI * 4) * 0.3 + 0.7;
        ringMat.opacity = (1 - snappy * 0.3) * glowPulse * 0.9;
      }

      // Outer edge ring rushes in from just beyond the tile border.
      if (outerRingRef.current) {
        const edgeScale = Math.max(0.01, 1.1 - snappy * 0.8);
        outerRingRef.current.scale.set(edgeScale, edgeScale, 1);
        outerMat.opacity = (1 - snappy) * 0.6;
      }

      // Core fills outward and fades — brightest at the crossing midpoint.
      if (innerGlowRef.current) {
        const fillScale = snappy * 0.95;
        innerGlowRef.current.scale.set(fillScale, fillScale, 1);
        innerMat.opacity = Math.sin(p * Math.PI) * 0.7;
      }
    },
  }), [outerMat, ringMat, innerMat]);

  return (
    <group ref={groupRef} position={[0, 0, 0.025]} visible={false} renderOrder={11}>
      <mesh ref={outerRingRef} geometry={_sharedOuterRingGeometry} material={outerMat} scale={[0, 0, 0]} />
      <mesh ref={ringRef} geometry={_sharedMainRingGeometry} material={ringMat} scale={[0, 0, 0]} />
      <mesh ref={innerGlowRef} position={[0, 0, -0.005]} geometry={_sharedInnerCircleGeometry} material={innerMat} scale={[0, 0, 0]} />
    </group>
  );
});

AntipodalGlowFill.displayName = 'AntipodalGlowFill';
export default AntipodalGlowFill;
