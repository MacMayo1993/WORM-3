// src/worm/wormCosmetics.jsx
// WormHat3D — 3D hat component for use inside a Canvas.
// Geometry lives in wormHatParts.js (shared with the preview renderer);
// data (skins, hats, helpers) lives in wormCosmeticsData.js.

import React from 'react';
import { getHatParts } from './wormHatParts.js';

// Geometry elements by spec name — the imperative builder in
// WormPreviewRenderer.js switches over the same set.
const GEOMETRY = {
  cylinder: args => <cylinderGeometry args={args} />,
  cone: args => <coneGeometry args={args} />,
  sphere: args => <sphereGeometry args={args} />,
  torus: args => <torusGeometry args={args} />,
  box: args => <boxGeometry args={args} />,
  octahedron: args => <octahedronGeometry args={args} />
};

// ─── WormHat3D ────────────────────────────────────────────────────────────────
// Renders a hat in the parent's local space where +Y is the "outward" direction.
// `scale` = head sphere radius in world units.
// React.memo: type and scale rarely change, so skip re-renders when parent re-renders at 30fps.
const WormHat3D = React.memo(function WormHat3D({ type, scale = 0.28 }) {
  const parts = getHatParts(type, scale);
  if (parts.length === 0) return null;

  return (
    <group>
      {parts.map((part, i) => {
        const [geoName, args] = part.geo;
        return (
          <mesh key={i} position={part.pos} rotation={part.rot} scale={part.scale}>
            {GEOMETRY[geoName](args)}
            <meshStandardMaterial {...part.mat} />
          </mesh>
        );
      })}
    </group>
  );
});

export default WormHat3D;
