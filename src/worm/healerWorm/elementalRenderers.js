// src/worm/healerWorm/elementalRenderers.js
//
// Which cube-skin renderer draws which element, and how the shared frame loop must
// drive it.
//
// ElementalCubeSkin used to decide this inline with a `SURFACE_ELEMENTS` set plus an
// `isFire` boolean, and every new element meant another branch in the JSX and
// another special case in the transform loop (fire needed a uniform scale because
// sprites take their on-screen size from world scale; the surface elements needed a
// squashed one). Adding lightning would have made that four-way. The branching is
// now a lookup table, and the one place that reads it is the frame loop.
//
// Pure data — no React, no Three — so the mapping is testable headlessly and a
// missing renderer is a soft null rather than a crash inside a Canvas.

/**
 * @typedef {object} ElementalRenderer
 * @property {string}  key          renderer id, matched in ElementalCubeSkin's JSX
 * @property {'instanced'|'perCell'} mode
 *   instanced — every cover cell is one instance of a single mesh, so the whole
 *               cube costs one draw call and the loop writes instance matrices
 *   perCell   — the cell owns a real child object graph and the loop writes its
 *               group transform (the fallback; more draw calls)
 * @property {boolean} uniformScale
 *   true when the cell transform must stay uniformly scaled. Camera-facing
 *   billboards derive their on-screen size from world scale, so the surface
 *   layers' squashed (cell, cell, grow) scale would distort them.
 */

/** @type {Record<string, ElementalRenderer>} */
export const ELEMENTAL_RENDERERS = {
  // Continuous animated element surface — one shared shader, one instanced quad
  // per cover cell (water, ice).
  surface: { key: 'surface', mode: 'instanced', uniformScale: false },
  // Camera-facing flame tongues over an ember bed, billboarded on the GPU (fire).
  flames: { key: 'flames', mode: 'instanced', uniformScale: true },
  // The Living style's instanced blade mesh, one per cover cell (nature).
  blades: { key: 'blades', mode: 'perCell', uniformScale: false }
};

/**
 * Resolve an element's renderer from its definition.
 *
 * Fails soft: an unknown element, or a definition naming a renderer that does not
 * exist, returns null and the skin draws nothing rather than throwing mid-frame or
 * falling back to some other element's look. Nothing is cached here, so a miss
 * leaks no GPU resource.
 *
 * @param {string|null} type
 * @param {(type: string) => ({renderer?: string}|null)} getDef
 * @returns {ElementalRenderer|null}
 */
export function resolveElementalRenderer(type, getDef) {
  if (!type) return null;
  const def = getDef?.(type);
  if (!def?.renderer) return null;
  return ELEMENTAL_RENDERERS[def.renderer] ?? null;
}
