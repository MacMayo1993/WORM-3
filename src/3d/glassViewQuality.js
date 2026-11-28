import { getViewPowerDef } from '../worm/healerWorm/viewPowerups.js';

// Glass keeps its transparent tint, rounded silhouette and antipodal back in
// every tier. Small desktop boards keep the full bevel; dense boards and the
// existing mobile/adaptive tiers spend fewer vertices on that thin bevel.
export const compactGlassGeometry = (size, mobile, reducedFX) => size >= 6 || mobile || reducedFX;

// Every view's cubie body takes the compact rounding (two steps: 236 triangles
// instead of 716) where a piece is too small on screen for the difference to
// show: boards from 6×6, phones from 4×4, and reduced FX. On an 8×8 the bodies
// were ~640k of the frame's ~766k triangles at full rounding.
export const compactBodyGeometry = (size, mobile, reducedFX) => size >= 6 || (mobile && size >= 4) || reducedFX;

// A view pickup overrides the saved view without changing it. Opaque-only
// passes must follow that temporary appearance too, then resume on expiry.
export const skipsOpaqueCubeEffects = view => view === 'glass' || view === 'wireframe';

export function opaqueCubePasses({ visualMode, wormHealerMode, wormViewPower }, mobile) {
  const available = !mobile && !skipsOpaqueCubeEffects(visualMode);
  const activeView = (wormHealerMode && getViewPowerDef(wormViewPower)?.view) || visualMode;
  return { available, enabled: available && !skipsOpaqueCubeEffects(activeView) };
}

/** Keep the shadow program/light alive, but do no shadow-map work for glass. */
export function updateCubeShadowCadence(shadowMap, enabled, slow, frame) {
  shadowMap.autoUpdate = enabled && !slow;
  shadowMap.needsUpdate = enabled && slow && frame % 4 === 0;
}
