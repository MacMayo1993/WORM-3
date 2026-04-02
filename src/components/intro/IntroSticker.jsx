import React, { useMemo } from 'react';
import * as THREE from 'three';
import { getTileStyleMaterial } from '../../3d/styles/TileStyleMaterials.jsx';

// Module-level cache so all cubies sharing the same style+color reuse one material
const _matCache = new Map();
function getCachedMat(styleKey, colorHex) {
  const key = `${styleKey}__${colorHex}`;
  if (!_matCache.has(key)) {
    const mat = getTileStyleMaterial(styleKey, colorHex);
    mat.side = THREE.FrontSide;
    _matCache.set(key, mat);
  }
  return _matCache.get(key);
}

/**
 * IntroSticker — a single coloured tile sticker on a cubie face.
 *
 * GEOMETRY FIX: planeGeometry lies in the XY plane by default (normal = +Z).
 * Each face's `rot` rotates it so the plane faces outward from the cube.
 * The flip animation must rotate around the plane's LOCAL X axis BEFORE
 * the face rotation is applied — otherwise the axis compounds incorrectly
 * and tiles appear to stand up instead of lying flat.
 *
 * We achieve this by nesting: outer group = face orientation,
 * inner mesh = flip rotation around local X (which is the tile's width axis).
 *
 * flipRotation — radians, 0 = flat, PI = fully flipped (shows back)
 */
const IntroSticker = ({ pos, rot, color, styleKey, flipRotation = 0 }) => {
  const shaderMat = useMemo(() => {
    if (!styleKey) return null;
    return getCachedMat(styleKey, color);
  }, [styleKey, color]);

  return (
    // Outer group positions the sticker on the face and orients it to face outward
    <group position={pos} rotation={rot}>
      {/* Inner group applies the flip rotation around the tile's local X axis
          (horizontal axis of the tile face). At flipRotation=0 tile is flat.
          At flipRotation=PI tile has rotated 180° and shows its back. */}
      <group rotation={[flipRotation, 0, 0]}>
        <mesh renderOrder={1}>
          <planeGeometry args={[0.88, 0.88]} />
          {shaderMat ? (
            <primitive object={shaderMat} attach="material" />
          ) : (
            <meshStandardMaterial
              color={color}
              roughness={0.35}
              metalness={0.0}
              side={THREE.FrontSide}
              emissive={color}
              emissiveIntensity={0.25}
            />
          )}
        </mesh>
        {/* Subtle border frame */}
        <mesh renderOrder={0} position={[0, 0, -0.001]}>
          <planeGeometry args={[0.96, 0.96]} />
          <meshStandardMaterial
            color="#111111"
            roughness={0.9}
            metalness={0.0}
            transparent
            opacity={0.6}
          />
        </mesh>
      </group>
    </group>
  );
};

export default IntroSticker;
