// src/worm/wormSkinFX.js
// Per-skin visual-theme profiles — material personality, body-surface
// displacement, and ambient particle FX — layered on top of the flat
// body/belly/antenna/glow colors in wormCosmeticsData.js. This is what makes
// Gold actually read as metal, Ice as glass, Lava as simmering rock, instead
// of plain color swaps of the same clearcoat-slime material.

// ── Bump styles (body-surface displacement, see wormSkinMaterial.js) ─────────
// 'none'   — smooth, relies on material + particles alone
// 'bump'   — organic noise-driven craggy/pustule bumps (amp/freq/speed)
// 'facet'  — quantized noise for chunky, crystalline low-poly steps
// 'ripple' — smooth traveling wave, no noise (regal shimmer / water ripple)
export const BUMP_STYLES = { none: 0, bump: 1, facet: 2, ripple: 3 };

// ── Particle styles (ambient FX around the head, see wormSkinParticles.js) ──
// 'none' | 'ember' | 'bubble' | 'sparkle' | 'snow' | 'star'
export const SKIN_FX = {
  slime: {
    material: { metalness: 0, roughness: 0.35, clearcoat: 1, clearcoatRoughness: 0.12, sheen: 0.4, sheenRoughness: 0.6 },
    bump: { style: 'none' },
    particle: { style: 'bubble', count: 8, speed: 0.35, size: 0.045, spread: 0.28 },
  },
  royal: {
    material: { metalness: 0.1, roughness: 0.22, clearcoat: 1, clearcoatRoughness: 0.08, sheen: 0.85, sheenRoughness: 0.3 },
    bump: { style: 'ripple', amp: 0.012, freq: 5, speed: 0.5 },
    particle: { style: 'sparkle', count: 10, speed: 0.5, size: 0.03, spread: 0.34 },
  },
  lava: {
    material: { metalness: 0, roughness: 0.6, clearcoat: 0.4, clearcoatRoughness: 0.4, sheen: 0 },
    bump: { style: 'bump', amp: 0.05, freq: 8, speed: 0.4 },
    particle: { style: 'ember', count: 14, speed: 1.3, size: 0.03, spread: 0.3 },
    pulse: { amp: 0.5, speed: 2.5 },
  },
  ocean: {
    material: { metalness: 0, roughness: 0.12, clearcoat: 1, clearcoatRoughness: 0.05, transmission: 0.6, ior: 1.33, thickness: 0.6 },
    bump: { style: 'ripple', amp: 0.02, freq: 7, speed: 0.8 },
    particle: { style: 'bubble', count: 12, speed: 0.6, size: 0.035, spread: 0.32 },
  },
  gold: {
    // Full metalness (1.0) reads as near-black without an environment map to
    // reflect — neither the store preview scene nor a worst-case HDR-load
    // failure in gameplay provides one, so this stays moderate enough that
    // direct lighting alone still reads as bright polished gold.
    material: { metalness: 0.55, roughness: 0.18, clearcoat: 0.7, clearcoatRoughness: 0.08, sheen: 0.2, sheenRoughness: 0.3 },
    bump: { style: 'none' },
    particle: { style: 'sparkle', count: 12, speed: 0.4, size: 0.028, spread: 0.3 },
  },
  cherry: {
    material: { metalness: 0, roughness: 0.2, clearcoat: 1, clearcoatRoughness: 0.04, sheen: 0.9, sheenRoughness: 0.25 },
    bump: { style: 'none' },
    particle: { style: 'sparkle', count: 8, speed: 0.45, size: 0.024, spread: 0.26 },
  },
  ice: {
    material: { metalness: 0, roughness: 0.04, clearcoat: 1, clearcoatRoughness: 0.02, transmission: 0.75, ior: 1.31, thickness: 0.4, iridescence: 0.25, iridescenceIOR: 1.3, flatShading: true },
    bump: { style: 'facet', amp: 0.018, freq: 5 },
    particle: { style: 'snow', count: 12, speed: 0.25, size: 0.03, spread: 0.4 },
  },
  void: {
    material: { metalness: 0, roughness: 0.95, clearcoat: 0, sheen: 0, emissiveIntensity: 0.05 },
    bump: { style: 'none' },
    particle: { style: 'star', count: 16, speed: 0.3, size: 0.02, spread: 0.5, orbit: true },
  },
  toxic: {
    material: { metalness: 0, roughness: 0.55, clearcoat: 0.3, clearcoatRoughness: 0.35, sheen: 0.9, sheenRoughness: 0.3 },
    bump: { style: 'bump', amp: 0.045, freq: 16, speed: 0.9 },
    particle: { style: 'bubble', count: 14, speed: 0.9, size: 0.03, spread: 0.32 },
  },
  bubble: {
    material: { metalness: 0, roughness: 0.15, clearcoat: 1, clearcoatRoughness: 0.02, sheen: 0.6, sheenRoughness: 0.2 },
    bump: { style: 'none' },
    particle: { style: 'bubble', count: 12, speed: 0.5, size: 0.05, spread: 0.34 },
  },
  galaxy: {
    material: { metalness: 0.3, roughness: 0.25, clearcoat: 0.5, clearcoatRoughness: 0.2, iridescence: 0.9, iridescenceIOR: 1.6, flatShading: true },
    bump: { style: 'facet', amp: 0.014, freq: 4 },
    particle: { style: 'star', count: 18, speed: 0.7, size: 0.022, spread: 0.5, orbit: true },
  },
  coral: {
    material: { metalness: 0, roughness: 0.8, clearcoat: 0.2, clearcoatRoughness: 0.5, sheen: 0.15, sheenRoughness: 0.7 },
    bump: { style: 'bump', amp: 0.03, freq: 22, speed: 0.25 },
    particle: { style: 'bubble', count: 8, speed: 0.3, size: 0.028, spread: 0.26 },
  },
  mono: {
    material: { metalness: 0, roughness: 0.9, clearcoat: 0, sheen: 0, emissiveIntensity: 0.05 },
    bump: { style: 'none' },
    particle: { style: 'none' },
  },
  sunset: {
    material: { metalness: 0, roughness: 0.3, clearcoat: 0.6, clearcoatRoughness: 0.2, sheen: 0.3, sheenRoughness: 0.5 },
    bump: { style: 'ripple', amp: 0.01, freq: 4, speed: 0.3 },
    particle: { style: 'sparkle', count: 12, speed: 0.3, size: 0.026, spread: 0.34 },
    pulse: { amp: 0.3, speed: 1.2 },
  },
  emerald: {
    material: { metalness: 0.45, roughness: 0.12, clearcoat: 1, clearcoatRoughness: 0.06, iridescence: 0, flatShading: true },
    bump: { style: 'facet', amp: 0.02, freq: 6 },
    particle: { style: 'sparkle', count: 10, speed: 0.4, size: 0.026, spread: 0.3 },
  },
};

const DEFAULT_FX = SKIN_FX.slime;

export function getSkinFX(skinId) {
  return SKIN_FX[skinId] ?? DEFAULT_FX;
}
