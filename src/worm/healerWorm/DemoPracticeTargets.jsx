import React from 'react';
import { useGameStore } from '../../hooks/useGameStore.js';
import { getStickerWorldPos } from '../../game/coordinates.js';
import { getWormholeHealRing } from '../wormLogic.js';

// These are depth-tested scene markers, so the lesson never draws through the
// cube. Offset and orient each marker along its own face, including back faces.
const FACES = {
  PZ: [[0, 0, 1], [0, 0, 0]], NZ: [[0, 0, -1], [0, Math.PI, 0]],
  PX: [[1, 0, 0], [0, Math.PI / 2, 0]], NX: [[-1, 0, 0], [0, -Math.PI / 2, 0]],
  PY: [[0, 1, 0], [-Math.PI / 2, 0, 0]], NY: [[0, -1, 0], [Math.PI / 2, 0, 0]],
};
export default function DemoPracticeTargets({ size }) {
  const target = useGameStore(s => s.wormStoryLevel ? s.wormStoryTarget : s.demoMode && s.demoStep === 'worm-traversal' && !s.demoWormFinished ? s.demoWormTarget : null);
  const phase = useGameStore(s => s.wormPhase);
  if (!target || phase !== 'crawling') return null;
  const tiles = target.ring ? [...getWormholeHealRing(target, size)].map(key => {
    const [x, y, z, dirKey] = key.split(','); return { x: +x, y: +y, z: +z, dirKey };
  }) : [target];
  return <group>{tiles.map(tile => <mesh key={`${tile.x}:${tile.y}:${tile.z}:${tile.dirKey}`} rotation={FACES[tile.dirKey][1]} position={getStickerWorldPos(tile.x, tile.y, tile.z, tile.dirKey, size, 0).map((v, i) => v + FACES[tile.dirKey][0][i] * 0.035)}>
    <ringGeometry args={[0.32, 0.39, 4, 1, Math.PI / 4]} />
    <meshBasicMaterial color="#e8ff9a" transparent opacity={0.9} depthWrite={false} toneMapped={false} />
  </mesh>)}</group>;
}
