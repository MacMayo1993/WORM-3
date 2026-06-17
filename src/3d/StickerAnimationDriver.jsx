// StickerAnimationDriver.jsx
//
// Single useFrame subscription that replaces the one-per-sticker useFrame
// subscriptions StickerPlane used to register (up to 294 at size 7). Must be
// mounted somewhere inside <StickerInstanceProvider>'s children — React fires
// child effects before parent effects, so this driver's useFrame subscribes
// (and therefore runs, within the same default priority band) before the
// provider's own useFrame, which reads groupRef.matrixWorld after this frame's
// sticker mutations have been applied. See StickerInstances.jsx for the
// matching comment on that ordering guarantee.
import { useFrame } from '@react-three/fiber';
import { healBurstMap, healParticleMap } from './styles/TileStyleMaterials.jsx';
import { wispyTime, activateSticker, runActiveStickers } from './StickerAnimationManager.js';

export default function StickerAnimationDriver() {
  useFrame((state, delta) => {
    // Shared wispy-ring time — written once here regardless of which stickers are
    // active, since every wispy ring material references this single object.
    wispyTime.value = state.clock.elapsedTime;

    // Safety net: heal triggers are normally activated explicitly at their call
    // site (HealerWormMode), but a stale/idle tile could in principle pick up an
    // entry here too. These maps are empty almost every frame, so the sweep is free.
    if (healBurstMap.size > 0) {
      for (const key of healBurstMap.keys()) activateSticker(key);
    }
    if (healParticleMap.size > 0) {
      for (const key of healParticleMap.keys()) activateSticker(key);
    }

    runActiveStickers(state, delta);
  });

  return null;
}
