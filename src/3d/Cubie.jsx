import React, { useMemo } from 'react';
import { RoundedBox } from '@react-three/drei';
import * as THREE from 'three';
import { COLORS, FACE_COLORS } from '../utils/constants.js';
import StickerPlane from './StickerPlane.jsx';
import WireframeEdge from './WireframeEdge.jsx';

// Helper functions for grid and sudokube modes
const faceRCFor = (dirKey, x, y, z, size) => {
  if (dirKey === 'PZ') {
    return { r: size - 1 - y, c: x };
  }
  if (dirKey === 'NZ') {
    return { r: size - 1 - y, c: size - 1 - x };
  }
  if (dirKey === 'PX') {
    return { r: size - 1 - y, c: size - 1 - z };
  }
  if (dirKey === 'NX') {
    return { r: size - 1 - y, c: z };
  }
  if (dirKey === 'PY') {
    return { r: z, c: x };
  }
  // NY
  return { r: size - 1 - z, c: x };
};

const faceValue = (dirKey, x, y, z, size) => {
  const { r, c } = faceRCFor(dirKey, x, y, z, size);
  // Latin square: value = (row + col) mod size + 1
  return ((r + c) % size) + 1;
};

const Cubie = React.forwardRef(function Cubie({
  position, cubie, size, onPointerDown, visualMode, explosionFactor = 0
}, ref) {
  const limit = (size - 1) / 2;
  const isEdge = (p, v) => Math.abs(p - v) < 0.01;

  const explodedPos = useMemo(() => {
    if (explosionFactor === 0) return position;
    const expansionFactor = 1.8;
    return [
      position[0] * (1 + explosionFactor * expansionFactor),
      position[1] * (1 + explosionFactor * expansionFactor),
      position[2] * (1 + explosionFactor * expansionFactor)
    ];
  }, [position, explosionFactor]);

  const handleDown = (e) => {
    e.stopPropagation();
    const rX = Math.round(position[0] + limit), rY = Math.round(position[1] + limit), rZ = Math.round(position[2] + limit);
    onPointerDown({ pos: { x: rX, y: rY, z: rZ }, worldPos: new THREE.Vector3(...position), event: e });
  };

  const meta = (d) => cubie.stickers[d] || null;

  const overlay = (dirKey) => {
    const m = meta(dirKey); if (!m) return '';
    if (visualMode === 'grid') {
      const { r, c } = faceRCFor(dirKey, cubie.x, cubie.y, cubie.z, size);
      const idx = r * size + c + 1;
      const idStr = String(idx).padStart(3, '0');
      return `M${m.curr}-${idStr}`;
    }
    if (visualMode === 'sudokube') {
      const v = faceValue(dirKey, cubie.x, cubie.y, cubie.z, size);
      return String(v);
    }
    return '';
  };

  // Helper to get edge color for wireframe mode
  const getEdgeColor = (dirKey) => {
    const sticker = cubie.stickers[dirKey];
    if (!sticker) return COLORS.black;
    return FACE_COLORS[sticker.curr];
  };

  // Determine which edges are visible (on cube exterior)
  const isOnEdge = {
    px: cubie.x === size - 1,
    nx: cubie.x === 0,
    py: cubie.y === size - 1,
    ny: cubie.y === 0,
    pz: cubie.z === size - 1,
    nz: cubie.z === 0
  };

  // Generate wireframe edges for wireframe mode ONLY
  const wireframeEdges = useMemo(() => {
    if (visualMode !== 'wireframe') return [];

    const halfSize = 0.49;
    const eps = 0.01;
    const edgeList = [];
    const pulsePhase = Math.random() * Math.PI * 2;

    // Front face (PZ) - 4 edges
    if (isOnEdge.pz) {
      const color = getEdgeColor('PZ');
      const intensity = 1.0;

      edgeList.push(
        { start: [-halfSize, -halfSize, halfSize + eps], end: [halfSize, -halfSize, halfSize + eps], color, intensity, pulsePhase },
        { start: [-halfSize, halfSize, halfSize + eps], end: [halfSize, halfSize, halfSize + eps], color, intensity, pulsePhase },
        { start: [-halfSize, -halfSize, halfSize + eps], end: [-halfSize, halfSize, halfSize + eps], color, intensity, pulsePhase },
        { start: [halfSize, -halfSize, halfSize + eps], end: [halfSize, halfSize, halfSize + eps], color, intensity, pulsePhase }
      );
    }

    // Back face (NZ) - 4 edges
    if (isOnEdge.nz) {
      const color = getEdgeColor('NZ');
      const intensity = 1.0;

      edgeList.push(
        { start: [-halfSize, -halfSize, -halfSize - eps], end: [halfSize, -halfSize, -halfSize - eps], color, intensity, pulsePhase },
        { start: [-halfSize, halfSize, -halfSize - eps], end: [halfSize, halfSize, -halfSize - eps], color, intensity, pulsePhase },
        { start: [-halfSize, -halfSize, -halfSize - eps], end: [-halfSize, halfSize, -halfSize - eps], color, intensity, pulsePhase },
        { start: [halfSize, -halfSize, -halfSize - eps], end: [halfSize, halfSize, -halfSize - eps], color, intensity, pulsePhase }
      );
    }

    // Right face (PX) - 4 edges (all edges, not just 2)
    if (isOnEdge.px) {
      const color = getEdgeColor('PX');
      const intensity = 1.0;

      edgeList.push(
        { start: [halfSize + eps, -halfSize, -halfSize], end: [halfSize + eps, halfSize, -halfSize], color, intensity, pulsePhase },
        { start: [halfSize + eps, -halfSize, halfSize], end: [halfSize + eps, halfSize, halfSize], color, intensity, pulsePhase },
        { start: [halfSize + eps, -halfSize, -halfSize], end: [halfSize + eps, -halfSize, halfSize], color, intensity, pulsePhase },
        { start: [halfSize + eps, halfSize, -halfSize], end: [halfSize + eps, halfSize, halfSize], color, intensity, pulsePhase }
      );
    }

    // Left face (NX) - 4 edges
    if (isOnEdge.nx) {
      const color = getEdgeColor('NX');
      const intensity = 1.0;

      edgeList.push(
        { start: [-halfSize - eps, -halfSize, -halfSize], end: [-halfSize - eps, halfSize, -halfSize], color, intensity, pulsePhase },
        { start: [-halfSize - eps, -halfSize, halfSize], end: [-halfSize - eps, halfSize, halfSize], color, intensity, pulsePhase },
        { start: [-halfSize - eps, -halfSize, -halfSize], end: [-halfSize - eps, -halfSize, halfSize], color, intensity, pulsePhase },
        { start: [-halfSize - eps, halfSize, -halfSize], end: [-halfSize - eps, halfSize, halfSize], color, intensity, pulsePhase }
      );
    }

    // Top face (PY) - 4 edges
    if (isOnEdge.py) {
      const color = getEdgeColor('PY');
      const intensity = 1.0;

      edgeList.push(
        { start: [-halfSize, halfSize + eps, -halfSize], end: [halfSize, halfSize + eps, -halfSize], color, intensity, pulsePhase },
        { start: [-halfSize, halfSize + eps, halfSize], end: [halfSize, halfSize + eps, halfSize], color, intensity, pulsePhase },
        { start: [-halfSize, halfSize + eps, -halfSize], end: [-halfSize, halfSize + eps, halfSize], color, intensity, pulsePhase },
        { start: [halfSize, halfSize + eps, -halfSize], end: [halfSize, halfSize + eps, halfSize], color, intensity, pulsePhase }
      );
    }

    // Bottom face (NY) - 4 edges
    if (isOnEdge.ny) {
      const color = getEdgeColor('NY');
      const intensity = 1.0;

      edgeList.push(
        { start: [-halfSize, -halfSize - eps, -halfSize], end: [halfSize, -halfSize - eps, -halfSize], color, intensity, pulsePhase },
        { start: [-halfSize, -halfSize - eps, halfSize], end: [halfSize, -halfSize - eps, halfSize], color, intensity, pulsePhase },
        { start: [-halfSize, -halfSize - eps, -halfSize], end: [-halfSize, -halfSize - eps, halfSize], color, intensity, pulsePhase },
        { start: [halfSize, -halfSize - eps, -halfSize], end: [halfSize, -halfSize - eps, halfSize], color, intensity, pulsePhase }
      );
    }

    return edgeList;
  }, [visualMode, cubie, isOnEdge, size]);

  return (
    <group position={explodedPos} ref={ref}>
      <RoundedBox args={[0.98, 0.98, 0.98]} radius={0.08} smoothness={6} onPointerDown={handleDown}>
        <meshStandardMaterial
          color={visualMode === 'wireframe' ? "#000000" : "#0a0a0a"}
          roughness={visualMode === 'wireframe' ? 0.9 : 0.25}
          metalness={visualMode === 'wireframe' ? 0 : 0.15}
          envMapIntensity={0.4}
        />
      </RoundedBox>

      {/* LED Wireframe edges ONLY in wireframe mode */}
      {visualMode === 'wireframe' && wireframeEdges.map((edge, idx) => (
        <WireframeEdge
          key={idx}
          start={edge.start}
          end={edge.end}
          color={edge.color}
          intensity={edge.intensity}
          pulsePhase={edge.pulsePhase}
        />
      ))}

      {/* Regular stickers for ALL other modes (classic, grid, sudokube) */}
      {visualMode !== 'wireframe' && (
        <>
          {isEdge(position[2], (size - 1) / 2) && meta('PZ') && <StickerPlane meta={meta('PZ')} pos={[0, 0, 0.51]} mode={visualMode} overlay={overlay('PZ')} />}
          {isEdge(position[2], -(size - 1) / 2) && meta('NZ') && <StickerPlane meta={meta('NZ')} pos={[0, 0, -0.51]} rot={[0, Math.PI, 0]} mode={visualMode} overlay={overlay('NZ')} />}
          {isEdge(position[0], (size - 1) / 2) && meta('PX') && <StickerPlane meta={meta('PX')} pos={[0.51, 0, 0]} rot={[0, Math.PI / 2, 0]} mode={visualMode} overlay={overlay('PX')} />}
          {isEdge(position[0], -(size - 1) / 2) && meta('NX') && <StickerPlane meta={meta('NX')} pos={[-0.51, 0, 0]} rot={[0, -Math.PI / 2, 0]} mode={visualMode} overlay={overlay('NX')} />}
          {isEdge(position[1], (size - 1) / 2) && meta('PY') && <StickerPlane meta={meta('PY')} pos={[0, 0.51, 0]} rot={[-Math.PI / 2, 0, 0]} mode={visualMode} overlay={overlay('PY')} />}
          {isEdge(position[1], -(size - 1) / 2) && meta('NY') && <StickerPlane meta={meta('NY')} pos={[0, -0.51, 0]} rot={[Math.PI / 2, 0, 0]} mode={visualMode} overlay={overlay('NY')} />}
        </>
      )}
    </group>
  );
});

export default React.memo(Cubie);
