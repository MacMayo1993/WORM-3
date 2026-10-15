// DOM bounds and gesture state shared with the camera without per-frame renders.
export const victoryViewport = { current: null };
export const VICTORY_FOV = 55;
export const VICTORY_PITCH = Math.atan(0.55);
export const victoryView = { yaw: 0, pitch: VICTORY_PITCH, zoom: 1, manual: false };
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
export function resetVictoryView() {
  Object.assign(victoryView, { yaw: 0, pitch: VICTORY_PITCH, zoom: 1, manual: false });
}
export function rotateVictoryView(dx, dy) {
  victoryView.yaw -= dx * 0.008;
  victoryView.pitch = clamp(victoryView.pitch + dy * 0.008, -1.35, 1.35);
  victoryView.manual = true;
}
export function zoomVictoryView(ratio) {
  victoryView.zoom = clamp(victoryView.zoom * ratio, 0.5, 1.8);
  victoryView.manual = true;
}

export function victoryCameraFrame(size, width, height, bounds) {
  const tangent = Math.tan(VICTORY_FOV * Math.PI / 360);
  const horizontal = tangent * bounds.width * width / height;
  const vertical = tangent * bounds.height;
  const s = Math.sin(VICTORY_PITCH), c = Math.cos(VICTORY_PITCH);
  // Fit the padded cube's corners throughout an azimuth orbit. A bounding sphere
  // wastes space above the cube, especially in a short mobile victory stage.
  const half = size / 2 + 0.45;
  const fitX = s + Math.SQRT2 * Math.hypot(c, 1 / horizontal);
  const fitY = Math.max(
    Math.abs(s + c / vertical) + Math.SQRT2 * Math.abs(c - s / vertical),
    Math.abs(s - c / vertical) + Math.SQRT2 * Math.abs(c + s / vertical)
  );
  return {
    distance: half * Math.max(fitX, fitY) * 1.04,
    offsetX: (0.5 - bounds.left - bounds.width / 2) * width,
    offsetY: (0.5 - bounds.top - bounds.height / 2) * height,
  };
}
