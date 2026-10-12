// The DOM reserves a clear window onto the existing game canvas. Share its
// normalized bounds with the camera without rerendering the game every frame.
export const victoryViewport = { current: null };

export const VICTORY_FOV = 55;

export function victoryCameraFrame(size, width, height, bounds) {
  const halfFov = VICTORY_FOV * Math.PI / 360;
  const narrow = Math.atan(Math.tan(halfFov) * Math.min(bounds.height, bounds.width * width / height));
  // Enclose every corner throughout the orbit, including the worm above the
  // stickers, with breathing room around the silhouette.
  const radius = Math.sqrt(3) * (size / 2 + 0.6);
  return {
    distance: radius / Math.sin(narrow) * 1.08,
    offsetX: (0.5 - bounds.left - bounds.width / 2) * width,
    offsetY: (0.5 - bounds.top - bounds.height / 2) * height,
  };
}
