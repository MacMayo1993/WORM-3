import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';

it('counts WebGL2 zero-length uploads as the remaining data, including source offsets', () => {
  class GL { bufferSubData() {} }
  class GL2 { bufferSubData() {} }
  const window = { requestAnimationFrame() {} };
  class Observer { observe() {} }
  const source = readFileSync('scripts/perf-worm/instrument.js', 'utf8');
  new Function('window', 'WebGLRenderingContext', 'WebGL2RenderingContext', 'PerformanceObserver', source)(window, GL, GL2, Observer);
  const ctx = new GL2(), data = new Float32Array(2048 * 16);
  ctx.bufferSubData(34962, 0, data, 0, 0);
  expect(window.__perf.c.bufBytes).toBe(131072);
  ctx.bufferSubData(34962, 0, data, 16, 0);
  expect(window.__perf.c.bufBytes).toBe(131072 + 131008);
  ctx.bufferSubData(34962, 0, data, 16, 32);
  expect(window.__perf.c.bufBytes).toBe(131072 + 131008 + 128);
  const old = new GL();
  old.bufferSubData(34962, 0, data.subarray(0, 16));
  expect(window.__perf.c.bufBytes).toBe(131072 + 131008 + 128 + 64);
});
