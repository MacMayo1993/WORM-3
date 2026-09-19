import React from 'react';
import { EffectComposer, Bloom, Vignette, N8AO } from '@react-three/postprocessing';

// Optional GPU passes load only when their owning scene enables them.
export default function SceneEffects({ kind, enabled = true }) {
  if (kind === 'game') return (
    <EffectComposer multisampling={4}>
      <N8AO aoRadius={0.55} distanceFalloff={1} intensity={2.2} quality="medium" halfRes />
    </EffectComposer>
  );
  return (
    <EffectComposer enabled={enabled}>
      {kind === 'intro' && <Bloom intensity={0.35} luminanceThreshold={0.85} luminanceSmoothing={0.85} mipmapBlur />}
      <Vignette offset={kind === 'intro' ? 0.35 : 0.46} darkness={kind === 'intro' ? 0.35 : 0.23} />
    </EffectComposer>
  );
}
