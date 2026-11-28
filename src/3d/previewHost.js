// src/3d/previewHost.js
// Where the main Canvas meets the thumbnail renderers (tile styles, worms, cubes).
//
// TilePreviewHost (App.jsx) lives inside the Canvas: it hands the renderers the
// main WebGL renderer, so no thumbnail needs a second context (a crash risk on
// phones), and ticks them every frame. It used to import the three renderers
// directly, which put them, and through them every tile style's shader (about
// 250 KB), on the first load. Each renderer now registers here when its module
// loads, with the screen that first shows a thumbnail, and is handed the shared
// renderer at once if the Canvas is already up.

let sharedRenderer = null;
const renderers = new Set();

/** Each preview renderer calls this once, from its own module. */
export function registerPreviewRenderer(renderer) {
  renderers.add(renderer);
  if (sharedRenderer) renderer.setShared(sharedRenderer);
}

/** TilePreviewHost: the Canvas's renderer is ready. */
export function setPreviewHostRenderer(gl) {
  sharedRenderer = gl;
  for (const renderer of renderers) renderer.setShared(gl);
}

/** TilePreviewHost: every frame. A renderer with nothing on screen costs one call. */
export function tickPreviewRenderers(delta) {
  for (const renderer of renderers) if (renderer.active()) renderer.tick(delta);
}
