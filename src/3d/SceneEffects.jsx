import React from 'react';
import { EffectComposer, Vignette, N8AO } from '@react-three/postprocessing';

// Optional GPU passes load only when their owning scene enables them.
export default function SceneEffects({ kind, enabled = true }) {
  // The game's composer is switched off with `enabled` rather than unmounted:
  // see GameScene (mounting it changes every program's key).
  if (kind === 'game') return (
    <EffectComposer multisampling={4} enabled={enabled}>
      <N8AO aoRadius={0.55} distanceFalloff={1} intensity={2.2} quality="medium" halfRes />
    </EffectComposer>
  );
  return (
    <EffectComposer enabled={enabled}>
      <Vignette offset={0.46} darkness={0.23} />
    </EffectComposer>
  );
}
