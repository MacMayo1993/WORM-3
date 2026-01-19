import React from 'react';
import { RoundedBox } from '@react-three/drei';
import IntroSticker from './IntroSticker.jsx';
import { FACE_COLORS } from '../../utils/constants.js';

const IntroCubie = React.forwardRef(({ position, size, explosionFactor = 0 }, ref) => {
  const limit = (size - 1) / 2;
  const x = Math.round(position[0] / (1 + explosionFactor * 1.8) + limit);
  const y = Math.round(position[1] / (1 + explosionFactor * 1.8) + limit);
  const z = Math.round(position[2] / (1 + explosionFactor * 1.8) + limit);

  // When exploded, show all faces; when collapsed, only show outer faces
  const showAllFaces = explosionFactor > 0.1;

  // Determine which faces should show based on position (outer faces of the cube)
  const isOuterPZ = z === size - 1;
  const isOuterNZ = z === 0;
  const isOuterPX = x === size - 1;
  const isOuterNX = x === 0;
  const isOuterPY = y === size - 1;
  const isOuterNY = y === 0;

  return (
    <group position={position} ref={ref}>
      <RoundedBox args={[0.98, 0.98, 0.98]} radius={0.05} smoothness={4}>
        <meshStandardMaterial color="#3d3225" roughness={0.6} metalness={0.1} />
      </RoundedBox>

      {/* Front face (PZ) - Red */}
      {(showAllFaces || isOuterPZ) && (
        <IntroSticker
          pos={[0, 0, 0.51]}
          rot={[0, 0, 0]}
          color={FACE_COLORS[1]}
          isBack={!isOuterPZ && showAllFaces}
        />
      )}

      {/* Back face (NZ) - Orange */}
      {(showAllFaces || isOuterNZ) && (
        <IntroSticker
          pos={[0, 0, -0.51]}
          rot={[0, Math.PI, 0]}
          color={FACE_COLORS[4]}
          isBack={!isOuterNZ && showAllFaces}
        />
      )}

      {/* Right face (PX) - Blue */}
      {(showAllFaces || isOuterPX) && (
        <IntroSticker
          pos={[0.51, 0, 0]}
          rot={[0, Math.PI / 2, 0]}
          color={FACE_COLORS[5]}
          isBack={!isOuterPX && showAllFaces}
        />
      )}

      {/* Left face (NX) - Green */}
      {(showAllFaces || isOuterNX) && (
        <IntroSticker
          pos={[-0.51, 0, 0]}
          rot={[0, -Math.PI / 2, 0]}
          color={FACE_COLORS[2]}
          isBack={!isOuterNX && showAllFaces}
        />
      )}

      {/* Top face (PY) - White */}
      {(showAllFaces || isOuterPY) && (
        <IntroSticker
          pos={[0, 0.51, 0]}
          rot={[-Math.PI / 2, 0, 0]}
          color={FACE_COLORS[3]}
          isBack={!isOuterPY && showAllFaces}
        />
      )}

      {/* Bottom face (NY) - Yellow */}
      {(showAllFaces || isOuterNY) && (
        <IntroSticker
          pos={[0, -0.51, 0]}
          rot={[Math.PI / 2, 0, 0]}
          color={FACE_COLORS[6]}
          isBack={!isOuterNY && showAllFaces}
        />
      )}
    </group>
  );
});

export default IntroCubie;
