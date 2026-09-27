// Render-only sticker anchors. The actual sticker group includes every cubie,
// pad and flip transform; no second copy of the gameplay position math.
export const inspectionSurfaces = new Map();
export function registerInspectionSurface(id, object) {
  if (!id || !object) return () => {};
  inspectionSurfaces.set(object, id);
  return () => inspectionSurfaces.delete(object);
}

// CSS-normalized coordinates, shared without triggering React on pointermove.
export const inspectionLens = { x: 0.5, y: 0.45, radius: 120 };

export function lensRect(width, height, lens = inspectionLens) {
  // Leave room for the caption and size control outside the viewing area.
  const radius = Math.min(lens.radius, Math.max(24, Math.min(width * 0.36, (height - 144) / 2)));
  const horizontalMargin = Math.max(radius + 8, Math.min(118, width / 2));
  return {
    radius,
    x: Math.max(horizontalMargin, Math.min(width - horizontalMargin, lens.x * width)),
    y: Math.max(radius + 60, Math.min(height - radius - 72, lens.y * height)),
  };
}

export const inspectionSuspended = state => !!(state.showWelcome || state.showMainMenu || state.showSettings || state.showHelp ||
  state.showAntipodalPiP || (state.wormHealerMode && ['entering', 'tunnel', 'exiting'].includes(state.wormPhase)));

export function inspectionBudget({ mobile = false, reduced = false, size = 3 } = {}) {
  if (reduced || size >= 10) return { portals: 1, portalSize: 128, lensSize: 256, fps: 8 };
  if (mobile) return { portals: 1, portalSize: 192, lensSize: 320, fps: 12 };
  return { portals: 2, portalSize: 256, lensSize: 512, fps: 24 };
}
