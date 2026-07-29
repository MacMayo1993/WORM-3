// PerfProbe — the in-Canvas half of the Mega Worm measurement harness.
//
// Mounts inside the R3F Canvas, samples the renderer's own counters once per
// frame, and publishes them through perfBridge for the DOM overlay to read.
// It draws nothing.
//
// Two deliberate choices:
//
//   • Priority 0, not a positive priority. In R3F v8 any useFrame with a
//     positive priority increments an internal counter that disables gl.render()
//     entirely (the same trap documented in StickerInstances.jsx). So this reads
//     gl.info *before* the current frame renders, which means the numbers are
//     the previous frame's — correct for a steady-state readout, and the only
//     ordering that is safe here.
//
//   • gl.info.reset() is never called. Three.js resets the render counters
//     itself at the start of each render when info.autoReset is on (the
//     default), so calling reset here would zero the very numbers we came to
//     read, and turning autoReset off would make every other consumer wrong.

import { useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { perfBridge, pushFrameSample, refreshFrameStats } from './perfBridge.js';

// How often the published percentile/counter readout refreshes, in seconds.
// The ring is fed every frame; only the sort and the DOM-visible fields are
// throttled, so a stall still lands in the samples that produce p95.
const PUBLISH_INTERVAL = 0.25;

export default function PerfProbe({ label = '', cubeSize = 0 }) {
  const { gl, scene } = useThree();
  const lastRef = useRef(0);
  const publishRef = useRef(0);

  useFrame(() => {
    const now = performance.now();
    const last = lastRef.current;
    lastRef.current = now;

    // First frame has no predecessor to measure against.
    if (last === 0) {
      perfBridge.active = true;
      perfBridge._scene = scene;
      perfBridge.label = label;
      perfBridge.cubeSize = cubeSize;
      return;
    }

    pushFrameSample(now - last);

    publishRef.current += (now - last) / 1000;
    if (publishRef.current < PUBLISH_INTERVAL) return;
    publishRef.current = 0;

    refreshFrameStats();

    perfBridge._scene = scene;
    const info = gl.info;
    perfBridge.drawCalls = info.render.calls;
    perfBridge.triangles = info.render.triangles;
    perfBridge.programs = info.programs?.length ?? 0;
    perfBridge.geometries = info.memory.geometries;
    perfBridge.textures = info.memory.textures;
    perfBridge.label = label;
    perfBridge.cubeSize = cubeSize;

    // Chromium-only; absent on Safari and Firefox, where the field stays 0.
    const mem = performance.memory;
    perfBridge.heapMB = mem ? Math.round(mem.usedJSHeapSize / 1048576) : 0;
  });

  return null;
}
