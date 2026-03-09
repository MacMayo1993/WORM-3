/**
 * MergeTileOverlay — per-sticker evolution visual for Merge Mode.
 *
 * Renders inside each StickerPlane when mergeMode is active.
 * Reads its own tier from the store so StickerPlane's memo stays intact
 * and only this small component re-renders after each rotation.
 *
 * Tier behaviour:
 *   1 → nothing rendered (early return)
 *   2 → theme character PNG floats above tile with a gentle pulse animation
 *   3 → final-form PNG pops forward on the z-axis with a brief scale-up burst
 *
 * Asset path: /WORM-3/merge-mode/<themeId>/color<colorIndex>/tier<N>.png
 * Missing assets are silently ignored (THREE.TextureLoader onError callback).
 */

import React, { useRef, useState, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useGameStore } from '../../hooks/useGameStore.js';

// Shared loader — reused across all overlay instances.
const _loader = new THREE.TextureLoader();

/**
 * Loads a texture by URL and calls onLoad/onError.
 * Returns a cleanup function that cancels the load.
 */
function loadTexture(url, onLoad, onError) {
  let cancelled = false;
  _loader.load(
    url,
    (tex) => { if (!cancelled) onLoad(tex); },
    undefined,
    () => { if (!cancelled && onError) onError(); }
  );
  return () => { cancelled = true; };
}

/**
 * Inner mesh that actually renders the PNG.
 * Separated so texture state is isolated and tier-1 bailout costs nothing.
 */
function TierMesh({ themeId, colorIndex, tier, meshRef }) {
  const [tex, setTex] = useState(null);
  const url = `/WORM-3/merge-mode/${themeId}/color${colorIndex}/tier${tier}.png`;

  useEffect(() => {
    setTex(null); // clear old texture immediately on url change
    return loadTexture(url, setTex);
  }, [url]);

  if (!tex) return null;

  const z = tier === 3 ? 0.05 : 0.02;

  return (
    <mesh ref={meshRef} position={[0, 0, z]}>
      <planeGeometry args={[0.78, 0.78]} />
      <meshBasicMaterial map={tex} transparent alphaTest={0.05} depthWrite={false} />
    </mesh>
  );
}

/**
 * MergeTileOverlay
 *
 * Props:
 *   homeKey    — stable string key: `${origPos.x}-${origPos.y}-${origPos.z}-${origDir}`
 *   themeId    — e.g. 'pokemon'
 *   colorIndex — sticker.curr face ID (1–6)
 */
export default function MergeTileOverlay({ homeKey, themeId, colorIndex }) {
  const tier = useGameStore((s) => s.mergeRegionTiers[homeKey] ?? 1);
  const meshRef = useRef();
  // Tracks whether a tier-3 pop-in burst is in progress.
  const prevTierRef = useRef(tier);
  const popRef = useRef(0); // 0 = idle, 0→1 = bursting

  // Trigger pop-in burst when tier reaches 3.
  useEffect(() => {
    if (tier === 3 && prevTierRef.current !== 3) {
      popRef.current = 0.001; // non-zero starts the burst clock in useFrame
    }
    prevTierRef.current = tier;
  }, [tier]);

  useFrame((_, delta) => {
    if (!meshRef.current) return;

    if (tier === 2) {
      // Gentle breathing pulse
      const t = performance.now() / 1000;
      const s = 1 + 0.06 * Math.sin(t * 3.5);
      meshRef.current.scale.setScalar(s);
      meshRef.current.position.z = 0.02;
    } else if (tier === 3) {
      if (popRef.current > 0 && popRef.current < 1) {
        // Pop-in: scale from 1.4 → 1.0 over ~0.35s
        popRef.current = Math.min(1, popRef.current + delta / 0.35);
        const ease = 1 - Math.pow(1 - popRef.current, 3); // ease-out cubic
        const s = 1.4 - 0.4 * ease;
        meshRef.current.scale.setScalar(s);
      } else {
        meshRef.current.scale.setScalar(1);
      }
      meshRef.current.position.z = 0.05;
    }
  });

  if (tier === 1) return null;

  return (
    <TierMesh
      themeId={themeId}
      colorIndex={colorIndex}
      tier={tier}
      meshRef={meshRef}
    />
  );
}
