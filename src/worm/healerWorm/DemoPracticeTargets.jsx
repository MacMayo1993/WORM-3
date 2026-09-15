import React from 'react';
import { useGameStore } from '../../hooks/useGameStore.js';
import { getStickerWorldPos } from '../../game/coordinates.js';
import { getWormholeHealRing } from '../wormLogic.js';

// These are depth-tested scene markers, so the lesson never draws through the
// cube. All practice targets are staged on PZ; rotation has no static marker.
export default function DemoPracticeTargets({ size }) {
  const target = useGameStore(s => s.demoMode && s.demoStep === 'worm-traversal' && !s.demoWormFinished ? s.demoWormTarget : null);
  const phase = useGameStore(s => s.wormPhase);
  if (!target || phase !== 'crawling') return null;
  const tiles = target.ring ? [...getWormholeHealRing(target, size)].map(key => {
    const [x, y, z, dirKey] = key.split(','); return { x: +x, y: +y, z: +z, dirKey };
  }) : [target];
  return <group>{tiles.map(tile => <mesh key={`${tile.x}:${tile.y}`} position={getStickerWorldPos(tile.x, tile.y, tile.z, tile.dirKey, size, 0).map((v, i) => i === 2 ? v + 0.035 : v)}>
    <ringGeometry args={[0.32, 0.39, 4, 1, Math.PI / 4]} />
    <meshBasicMaterial color="#e8ff9a" transparent opacity={0.9} depthWrite={false} toneMapped={false} />
  </mesh>)}</group>;
}
