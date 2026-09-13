// Arc-length lookup keeps the head at steady speed around the oval. Each body
// segment samples the same trail, rather than sliding sideways as a rigid rig.
const STEPS = 256;
const RX = 0.38;
const RZ = 0.19;
const lengths = [0];
for (let i = 1; i <= STEPS; i++) {
  const a = (i - 1) * Math.PI * 2 / STEPS;
  const b = i * Math.PI * 2 / STEPS;
  lengths.push(lengths[i - 1] + Math.hypot(RX * (Math.cos(b) - Math.cos(a)), RZ * (Math.sin(b) - Math.sin(a))));
}
export const PREVIEW_PATH_LENGTH = lengths[STEPS];
export const PREVIEW_CRAWL_SPEED = 0.36;

export function previewPathPoint(distance, out, lateral = 0) {
  const d = ((distance % PREVIEW_PATH_LENGTH) + PREVIEW_PATH_LENGTH) % PREVIEW_PATH_LENGTH;
  let lo = 0, hi = STEPS;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (lengths[mid] <= d) lo = mid;
    else hi = mid;
  }
  const angle = (lo + (d - lengths[lo]) / (lengths[hi] - lengths[lo])) * Math.PI * 2 / STEPS;
  // Offset along the outward normal; small character wiggles remain on the tile.
  out.x = -0.30 + (RX + lateral) * Math.cos(angle);
  out.z = (RZ + lateral) * Math.sin(angle);
  return out;
}

export function nextPreviewFrame(previous, now, step) {
  // Preserve cadence without catch-up renders after a stalled/hidden frame.
  return previous == null ? now + step : previous + (Math.floor(Math.max(0, now - previous) / step) + 1) * step;
}
