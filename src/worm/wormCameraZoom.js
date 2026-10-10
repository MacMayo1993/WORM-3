// The player's WORM chase-camera distance: a multiple of the authored surface
// framing (height above the face, setback behind the head, portrait rake), set
// from the pause menu, Settings → Scene, or the mouse wheel while crawling.
//
// 1 is the original lens. Players found it tight once the worm grows long, so the
// default stands a fifth further back; the range runs from a little closer than
// the original out to twice its distance. Growth framing (zoomLimit.js) still
// applies on top, so a long worm pulls the view back at every setting.

export const WORM_CAMERA_ZOOM = Object.freeze({ min: 0.85, max: 2, step: 0.05, default: 1.2 });
export const WORM_CAMERA_ZOOM_KEY = 'worm3_camera_zoom';

/** A safe zoom from anything (stored text, a slider value): clamped, else the default. */
export function clampWormCameraZoom(value) {
  if (value === null || value === undefined || value === '') return WORM_CAMERA_ZOOM.default;
  const number = Number(value);
  if (!Number.isFinite(number)) return WORM_CAMERA_ZOOM.default;
  return Math.min(WORM_CAMERA_ZOOM.max, Math.max(WORM_CAMERA_ZOOM.min, number));
}

/** One wheel event's change, multiplicative so each notch feels the same at any distance. */
export function wheelCameraZoom(zoom, deltaY) {
  const notches = Math.max(-3, Math.min(3, deltaY / 100));
  return clampWormCameraZoom(clampWormCameraZoom(zoom) * Math.exp(notches * 0.08));
}

/** Short label for the slider, e.g. "1.2×". */
export const wormCameraZoomLabel = zoom => `${clampWormCameraZoom(zoom).toFixed(2).replace(/0$/, '')}×`;

// How far the desktop chase aims at the head rather than the cube's centre. Small
// cubes keep the whole-board composition. On a big board the centre lies far below
// the surface, so aiming at it pitched the lens into the face and parked the worm
// at the top edge, its path ahead under the HUD; from 6×6 the aim slides over to
// the head, and from 8×8 the head is centred as it is on phones.
export function desktopHeadFraming(size) {
  const t = Math.min(1, Math.max(0, (size - 5) / 3));
  return t * t * (3 - 2 * t);
}
