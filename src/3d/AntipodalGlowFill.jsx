// src/3d/AntipodalGlowFill.jsx
// Antipodal glow fill — the crossing beat. Two thin rings of the new colour are
// drawn in from the tile's rim toward its centre, reading as the tile being pulled
// through the manifold rather than merely recoloured. Sits under the shockwave,
// which throws its ring the other way; together they read as "pulled in, punched
// out". Only lines move across the tile: it never fills with a flat wash, which
// read as the whole sticker flashing one colour and broke the action.
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
const _sharedOuterRingGeometry = new THREE.RingGeometry(0.45, 0.5, 32);
const _sharedMainRingGeometry = new THREE.RingGeometry(0.39, 0.45, 32);

const AntipodalGlowFill = React.forwardRef((_props, ref) => {
  const groupRef = useRef();
  const ringRef = useRef();
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

  React.useEffect(() => () => {
    outerMat.dispose();
    ringMat.dispose();
  }, [outerMat, ringMat]);

  useImperativeHandle(ref, () => ({
    trigger(color) {
      if (color) {
        outerMat.color.set(color);
        ringMat.color.set(color);
      }
      if (groupRef.current) groupRef.current.visible = true;
    },
    // Advanced 0→1 by the parent tick (active-registry driven); ≥1 = spent.
    setProgress(p) {
      if (p >= 1) {
        outerMat.opacity = 0;
        ringMat.opacity = 0;
        if (groupRef.current) groupRef.current.visible = false;
        return;
      }
      const snappy = 1 - Math.pow(1 - p, 3);

      // Main ring is drawn in from the rim, pulsing, and fades before it reaches
      // the centre, so it stays a line and never piles up into a disc.
      if (ringRef.current) {
        const ringScale = Math.max(0.01, 1 - snappy * 0.7);
        ringRef.current.scale.set(ringScale, ringScale, 1);
        const glowPulse = Math.sin(p * Math.PI * 4) * 0.25 + 0.75;
        ringMat.opacity = (1 - snappy) * glowPulse * 0.6;
      }

      // Outer edge ring rushes in from just beyond the tile border.
      if (outerRingRef.current) {
        const edgeScale = Math.max(0.01, 1.1 - snappy * 0.6);
        outerRingRef.current.scale.set(edgeScale, edgeScale, 1);
        outerMat.opacity = (1 - snappy) * 0.45;
      }
    },
  }), [outerMat, ringMat]);

  return (
    <group ref={groupRef} position={[0, 0, 0.025]} visible={false} renderOrder={11}>
      <mesh ref={outerRingRef} geometry={_sharedOuterRingGeometry} material={outerMat} scale={[0, 0, 0]} />
      <mesh ref={ringRef} geometry={_sharedMainRingGeometry} material={ringMat} scale={[0, 0, 0]} />
    </group>
  );
});

AntipodalGlowFill.displayName = 'AntipodalGlowFill';
export default AntipodalGlowFill;
