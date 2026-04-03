import React from 'react';
import { RoundedBox } from '@react-three/drei';
import IntroSticker from './IntroSticker.jsx';
import { FACE_COLORS } from '../../utils/constants.js';

/**
 * IntroCubie — a single small cube piece in the intro scene.
 *
 * FACE GEOMETRY (how planeGeometry maps to cube faces):
 *   planeGeometry default normal = +Z (faces toward camera when unrotated)
 *
 *   PZ (front,  z=max): pos=[0,0,+0.53]  rot=[0,0,0]          — already faces +Z ✓
 *   NZ (back,   z=min): pos=[0,0,-0.53]  rot=[0,PI,0]          — flip around Y to face -Z
 *   PX (right,  x=max): pos=[+0.53,0,0]  rot=[0,-PI/2,0]       — rotate -90° Y to face +X
 *   NX (left,   x=min): pos=[-0.53,0,0]  rot=[0,+PI/2,0]       — rotate +90° Y to face -X
 *   PY (top,    y=max): pos=[0,+0.53,0]  rot=[+PI/2,0,0]       — rotate +90° X to face +Y
 *   NY (bottom, y=min): pos=[0,-0.53,0]  rot=[-PI/2,0,0]       — rotate -90° X to face -Y
 *
 * faceReveal — object { PZ, NZ, PX, NX, PY, NY } each 0→1, controls glow/visibility.
 *
 * DEFAULT is fully revealed (all faces = 1) so the component works correctly
 * when used outside the intro sequence (e.g. title screen background cube).
 * The intro scene always passes an explicit faceReveal computed from time.
 *
 * cubieFlips — object { face: radians } for the Rummikub tile-flip animation
 * antipodalSwaps — object { face: bool } true = show antipodal color
 */

// Canonical "all faces fully revealed" object — shared reference avoids allocations
const FULL_REVEAL = { PZ: 1, NZ: 1, PX: 1, NX: 1, PY: 1, NY: 1 };

const IntroCubie = React.forwardRef(({
  position,
  gridPos = null,
  size,
  explosionFactor = 0,
  faceStyles = {},
  cubieFlips = {},
  antipodalSwaps = {},
  faceReveal = FULL_REVEAL,   // default = fully revealed, never black
}, ref) => {
  const limit = (size - 1) / 2;
  // In IntroScene, cubies are wrapped in a parent <group position={...}> and this
  // component receives local position [0,0,0]. Use explicit gridPos when supplied.
  const x = gridPos ? gridPos[0] : Math.round(position[0] / (1 + explosionFactor * 1.8) + limit);
  const y = gridPos ? gridPos[1] : Math.round(position[1] / (1 + explosionFactor * 1.8) + limit);
  const z = gridPos ? gridPos[2] : Math.round(position[2] / (1 + explosionFactor * 1.8) + limit);

  const exploded = explosionFactor > 0;
  const isOuterPZ = exploded || z === size - 1;
  const isOuterNZ = exploded || z === 0;
  const isOuterPX = exploded || x === size - 1;
  const isOuterNX = exploded || x === 0;
  const isOuterPY = exploded || y === size - 1;
  const isOuterNY = exploded || y === 0;

  const colorMap = { PZ: 1, NZ: 4, PX: 5, NX: 2, PY: 3, NY: 6 };
  const antipodalMap = { PZ: 'NZ', NZ: 'PZ', PX: 'NX', NX: 'PX', PY: 'NY', NY: 'PY' };

  const getDisplayColor = (face) => {
    if (antipodalSwaps[face]) {
      return FACE_COLORS[colorMap[antipodalMap[face]]];
    }
    const reveal = faceReveal[face] ?? 1; // undefined → treat as fully revealed
    if (reveal < 0.01) return '#0a0a0a';  // black — unrevealed (intro only)
    return FACE_COLORS[colorMap[face]];
  };

  const getDisplayStyle = (face) => {
    const reveal = faceReveal[face] ?? 1;
    if (reveal < 0.5) return undefined;
    if (antipodalSwaps[face]) {
      return faceStyles[antipodalMap[face]];
    }
    return faceStyles[face];
  };

  // Face definitions: [dirKey, outerFlag, pos, rot]
  const FACE_DEFS = [
    { key: 'PZ', outer: isOuterPZ, pos: [0, 0,  0.53], rot: [0, 0, 0] },
    { key: 'NZ', outer: isOuterNZ, pos: [0, 0, -0.53], rot: [0, Math.PI, 0] },
    { key: 'PX', outer: isOuterPX, pos: [ 0.53, 0, 0], rot: [0, -Math.PI / 2, 0] },
    { key: 'NX', outer: isOuterNX, pos: [-0.53, 0, 0], rot: [0,  Math.PI / 2, 0] },
    { key: 'PY', outer: isOuterPY, pos: [0,  0.53, 0], rot: [ Math.PI / 2, 0, 0] },
    { key: 'NY', outer: isOuterNY, pos: [0, -0.53, 0], rot: [-Math.PI / 2, 0, 0] },
  ];

  return (
    <group position={position} ref={ref}>
      {/* Cubie body */}
      <RoundedBox args={[0.98, 0.98, 0.98]} radius={0.06} smoothness={4}>
        <meshStandardMaterial
          color="#080808"
          roughness={0.15}
          metalness={0.3}
          envMapIntensity={0.5}
        />
      </RoundedBox>

      {FACE_DEFS.map(({ key, outer, pos, rot }) => {
        if (!outer) return null;
        return (
          <IntroSticker
            key={key}
            pos={pos}
            rot={rot}
            color={getDisplayColor(key)}
            styleKey={getDisplayStyle(key)}
            flipRotation={cubieFlips[key] || 0}
          />
        );
      })}
    </group>
  );
});

export default IntroCubie;
