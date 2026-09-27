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
  if (reduced || size >= 10) return { portals: 0, portalSize: 128, lensSize: 256, lensFps: 8 };
  if (mobile) return { portals: 1, portalSize: 128, lensSize: 320, lensFps: 12 };
  return { portals: 1, portalSize: 192, lensSize: 512, lensFps: 24 };
}

// Live means a fresh capture each game frame. If that cannot remain smooth,
// remove the extra render entirely rather than showing an 8–12 Hz video feed.
// Latch until an explicit retry so recovering FPS cannot cause an on/off loop.
export function createPortalPerformanceGuard() {
  let frames = 0, frameTime = 0, blocked = false;
  return {
    allowFrame(delta, capturedLastFrame, reduced) {
      if (reduced) blocked = true;
      if (capturedLastFrame && delta > 0 && Number.isFinite(delta)) {
        frames++;
        // Average catches bursty GPU stalls too. Cap a single shader compile or
        // tab-restoration hitch so it cannot dominate an otherwise healthy run.
        frameTime += Math.min(delta, 0.1);
        if (frames >= 12) {
          if (frameTime / frames > 1 / 40) blocked = true;
          frames = 0; frameTime = 0;
        }
      } else { frames = 0; frameTime = 0; }
      return !blocked;
    },
    reset() { frames = 0; frameTime = 0; blocked = false; },
  };
}
