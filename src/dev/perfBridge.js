// Shared mutable state written by PerfProbe (inside the Canvas, on the Three.js
// RAF) and read by PerfHud (DOM RAF). A plain object, matching the same
// bridge idiom the worm mode uses for tunnelProgressBridge / wormBuffs: this is
// 60 Hz data, so routing it through Zustand would cost a React render per frame
// to display numbers that only exist to measure how expensive renders are.
//
// The frame-time ring is pre-allocated and never grows — a measurement harness
// that allocates on every frame would corrupt the very allocation numbers it is
// there to report.

// One second at 120 fps. Long enough for a stable p95, short enough that the
// readout tracks a stall rather than averaging it away.
export const FRAME_SAMPLES = 120;

export const perfBridge = {
  // Sampling state
  active: false,
  samples: new Float32Array(FRAME_SAMPLES),
  sampleCount: 0,     // how many slots hold real data (saturates at FRAME_SAMPLES)
  sampleHead: 0,      // next write index

  // Published readout, refreshed on the publish cadence below
  fps: 0,
  frameMs: 0,         // most recent frame
  p50Ms: 0,
  p95Ms: 0,
  drawCalls: 0,
  triangles: 0,
  programs: 0,
  geometries: 0,
  textures: 0,
  heapMB: 0,          // 0 when performance.memory is unavailable (non-Chromium)

  // Scene context, set by whoever mounts the probe
  label: '',
  cubeSize: 0,
};

// Scratch buffer for the percentile sort. Reused so the publish step allocates
// nothing; only the populated prefix is ever sorted.
const _sorted = new Float32Array(FRAME_SAMPLES);

/** Record one frame's duration in milliseconds. */
export function pushFrameSample(ms) {
  perfBridge.samples[perfBridge.sampleHead] = ms;
  perfBridge.sampleHead = (perfBridge.sampleHead + 1) % FRAME_SAMPLES;
  if (perfBridge.sampleCount < FRAME_SAMPLES) perfBridge.sampleCount++;
  perfBridge.frameMs = ms;
}

/**
 * Recompute the published percentiles from the ring. Called on the publish
 * cadence (a few times a second), not per frame — sorting 120 floats every
 * frame would itself show up in the measurement.
 */
export function refreshFrameStats() {
  const n = perfBridge.sampleCount;
  if (n === 0) {
    perfBridge.p50Ms = 0;
    perfBridge.p95Ms = 0;
    perfBridge.fps = 0;
    return;
  }
  _sorted.set(perfBridge.samples.subarray(0, n));
  // subarray().sort() sorts in place within the view, leaving the rest untouched.
  _sorted.subarray(0, n).sort();
  perfBridge.p50Ms = _sorted[Math.min(n - 1, Math.floor(n * 0.5))];
  perfBridge.p95Ms = _sorted[Math.min(n - 1, Math.floor(n * 0.95))];
  perfBridge.fps = perfBridge.p50Ms > 0 ? 1000 / perfBridge.p50Ms : 0;
}

/** Clear the ring — use when switching scenes so old frames don't skew the run. */
export function resetPerfBridge() {
  perfBridge.samples.fill(0);
  perfBridge.sampleCount = 0;
  perfBridge.sampleHead = 0;
  perfBridge.fps = 0;
  perfBridge.frameMs = 0;
  perfBridge.p50Ms = 0;
  perfBridge.p95Ms = 0;
  perfBridge.drawCalls = 0;
  perfBridge.triangles = 0;
  perfBridge.programs = 0;
  perfBridge.geometries = 0;
  perfBridge.textures = 0;
  perfBridge.heapMB = 0;
}

/** Snapshot of the current readout, for logging or a bench capture. */
export function perfSnapshot() {
  return {
    label: perfBridge.label,
    cubeSize: perfBridge.cubeSize,
    fps: Math.round(perfBridge.fps),
    p50Ms: +perfBridge.p50Ms.toFixed(2),
    p95Ms: +perfBridge.p95Ms.toFixed(2),
    drawCalls: perfBridge.drawCalls,
    triangles: perfBridge.triangles,
    programs: perfBridge.programs,
    geometries: perfBridge.geometries,
    textures: perfBridge.textures,
    heapMB: perfBridge.heapMB,
  };
}
