import { test, expect } from '@playwright/test';
import * as THREE from 'three';
import { corePassageGLSL, makeCorePassage, updateCorePassage, coreOpeningRadius } from '../src/3d/corePassage.js';
import { exteriorPortalGLSL, createExteriorPortals } from '../src/3d/exteriorPortals.js';
import { interiorPortalGLSL, makeInteriorPortals, syncInteriorPortals } from '../src/worm/healerWorm/interiorPortals.js';
import { tunnelCoreScale, tunnelDockWidth } from '../src/utils/tunnelPath.js';
import { WORM_PAD_HEIGHT, wormRaisedAmount } from '../src/game/raisedCubie.js';
import { SURFACE_OFFSET } from '../src/utils/constants.js';

const coordinates = ['x', 'y', 'z'];
const route = (size, corner = false) => ({
  entry: { x: corner ? size - 1 : Math.floor((size - 1) / 2), y: size - 1, z: corner ? size - 1 : Math.floor((size - 1) / 2), dirKey: 'PY' },
  exit: { x: 0, y: corner ? 0 : Math.floor((size - 1) / 2), z: Math.floor((size - 1) / 2), dirKey: 'NX' },
  padHeight: WORM_PAD_HEIGHT, padExpansion: wormRaisedAmount(size)
});
const encode = uniforms => Object.fromEntries(Object.entries(uniforms).map(([name, { value }]) =>
  [name, value?.isDataTexture ? { data: Array.from(value.image.data), width: value.image.width, height: value.image.height } : Array.isArray(value) ? value.flatMap(v => v.toArray()) : value?.isVector3 ? value.toArray() : value]));

// Draw the production GLSL, rather than reproducing its distance formula in JS.
// Each point occupies one framebuffer pixel: red means discarded, green retained.
async function rasterize(page, source, cases) {
  return page.evaluate(({ source, cases }) => {
    const canvas = document.createElement('canvas');
    canvas.width = 512; canvas.height = 1;
    const gl = canvas.getContext('webgl', { preserveDrawingBuffer: true, antialias: false });
    if (!gl) throw new Error('WebGL is required for aperture boundary regressions');
    const compile = (type, source) => {
      const shader = gl.createShader(type); gl.shaderSource(shader, source); gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader));
      return shader;
    };
    const program = gl.createProgram();
    gl.attachShader(program, compile(gl.VERTEX_SHADER, `attribute vec3 aPoint; attribute float aPixel; varying vec3 point;
      void main() { point = aPoint; gl_Position = vec4((aPixel + .5) / 256. - 1., 0., 0., 1.); gl_PointSize = 1.; }`));
    gl.attachShader(program, compile(gl.FRAGMENT_SHADER, `precision highp float; varying vec3 point; ${source}
      void main() { gl_FragColor = portalDistance(point) < 0. ? vec4(1.,0.,0.,1.) : vec4(0.,1.,0.,1.); }`));
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program));
    gl.useProgram(program);
    const attribute = (name, width, data) => {
      const location = gl.getAttribLocation(program, name);
      gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(data), gl.STATIC_DRAW);
      gl.enableVertexAttribArray(location); gl.vertexAttribPointer(location, width, gl.FLOAT, false, 0, 0);
    };
    const failures = [], textures = [];
    for (const item of cases) {
      for (const [name, value] of Object.entries(item.uniforms)) {
        const location = gl.getUniformLocation(program, name);
        if (location === null) continue;
        if (value?.data) {
          gl.activeTexture(gl.TEXTURE0);
          const texture = gl.createTexture();
          gl.bindTexture(gl.TEXTURE_2D, texture);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
          gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, value.width, value.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(value.data));
          gl.uniform1i(location, 0);
          // Release after the cases finish so the current draw keeps its binding.
          textures.push(texture);
        } else if (Array.isArray(value)) gl.uniform3fv(location, value);
        else gl.uniform1f(location, value);
      }
      attribute('aPoint', 3, item.probes.flatMap(p => p.point));
      attribute('aPixel', 1, item.probes.map((_, i) => i));
      gl.clear(gl.COLOR_BUFFER_BIT); gl.drawArrays(gl.POINTS, 0, item.probes.length);
      const pixels = new Uint8Array(item.probes.length * 4);
      gl.readPixels(0, 0, item.probes.length, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
      item.probes.forEach((probe, i) => {
        const open = pixels[i * 4] > 127;
        if (open !== probe.open) failures.push({ label: item.label, ...probe, actual: open });
      });
    }
    const error = gl.getError();
    textures.forEach(texture => gl.deleteTexture(texture));
    const activeUniforms = gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS);
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return { failures, error, activeUniforms };
  }, { source, cases });
}

// Exact wall-plane intersections of the same sampled curve uploaded to the GPU.
function wallCrossings(points, center, half) {
  const crossings = [];
  for (const axis of coordinates) for (const sign of [-1, 1]) {
    const wall = center[axis] + sign * half;
    for (let i = 1; i < points.length; i++) {
      const a = points[i - 1], b = points[i], delta = b[axis] - a[axis];
      if (Math.abs(delta) < 1e-8) continue;
      const t = (wall - a[axis]) / delta;
      if (t < 0 || t > 1) continue;
      const point = a.clone().lerp(b, t);
      if (coordinates.some(k => k !== axis && Math.abs(point[k] - center[k]) > half - 1e-5)) continue;
      if (crossings.some(c => c.point.distanceTo(point) < 1e-7)) continue;
      crossings.push({ point, axis });
    }
  }
  return crossings;
}

test('core aperture pixels stay tile-sized at every size and zoom, without a second sightline hole', async ({ page }) => {
  const passage = makeCorePassage(), cases = [];
  for (let size = 2; size <= 15; size++) for (const corner of [false, true]) for (const zoom of [1, 1.5, 2, 4, 6]) {
    updateCorePassage(passage, route(size, corner), size, 0);
    const center = passage.path.midA.clone().multiplyScalar(1 - zoom);
    const half = .2125 * zoom, radius = coreOpeningRadius(size, zoom), cell = tunnelCoreScale(size) * zoom;
    expect(radius * 2).toBeLessThan(tunnelDockWidth(size) * zoom);
    passage.uniforms.uCoreRoomCenter.value.copy(center);
    passage.uniforms.uPassageRadius.value = radius;
    // An offset lens/head sightline must not cut an unrelated tile.
    passage.uniforms.uSightRadius.value = radius * 3;
    passage.uniforms.uSightStart.value.copy(center).add(new THREE.Vector3(half * 2, 0, 0));
    passage.uniforms.uSightEnd.value.copy(center);
    const probes = [];
    for (const { point, axis } of wallCrossings(passage.uniforms.uPassagePoints.value, center, half)) {
      probes.push({ point: point.toArray(), open: true, kind: 'centerline' });
      for (const tangent of coordinates.filter(k => k !== axis)) for (const sign of [-1, 1]) {
        const boundary = point.clone(); boundary[tangent] += sign * radius * 1.03;
        if (Math.abs(boundary[tangent] - center[tangent]) < half - 1e-5)
          probes.push({ point: boundary.toArray(), open: false, kind: 'outside-circle' });
        const neighbor = point.clone(); neighbor[tangent] += sign * cell;
        if (Math.abs(neighbor[tangent] - center[tangent]) < half - 1e-5)
          probes.push({ point: neighbor.toArray(), open: false, kind: 'neighbor' });
      }
    }
    expect(probes.length).toBeGreaterThan(0);
    cases.push({ label: { size, corner, zoom }, uniforms: encode(passage.uniforms), probes });
  }
  const result = await rasterize(page, corePassageGLSL, cases);
  expect(result.error).toBe(0);
  expect(result.failures).toEqual([]);
});

test('inner and outer mouth pixels preserve neighboring corner faces', async ({ page }) => {
  const exterior = createExteriorPortals(), interior = makeInteriorPortals();
  const exteriorCases = [], interiorCases = [];
  try {
    for (let size = 2; size <= 15; size++) for (const corner of [false, true]) {
      const tunnel = route(size, corner);
      exterior.update(tunnel, size, 0); syncInteriorPortals(interior, tunnel, size, 0);
      const half = (size - 1) / 2 + SURFACE_OFFSET;
      const probes = [];
      for (let side = 0; side < 2; side++) {
        const center = interior.centers[side];
        const normal = interior.normals[side];
        const axis = coordinates.find(k => Math.abs(normal[k]) > .5);
        probes.push({ point: center.toArray(), open: true, kind: 'centerline' });
        for (const tangent of coordinates.filter(k => k !== axis)) {
          const outside = center.clone(); outside[tangent] += .34 * (center[tangent] > 0 ? -1 : 1);
          probes.push({ point: outside.toArray(), open: false, kind: 'outside-circle' });
          if (!corner) continue;
          // The same bore is close enough to a perpendicular wall to cut it
          // unless the shader checks which face owns the mouth.
          const neighbor = center.clone(); neighbor[tangent] = Math.sign(center[tangent] || 1) * half;
          neighbor[axis] -= Math.sign(normal[axis]) * .06;
          probes.push({ point: neighbor.toArray(), open: false, kind: 'perpendicular-face' });
        }
      }
      exteriorCases.push({ label: { size, corner }, uniforms: encode(exterior.uniforms), probes });
      interiorCases.push({ label: { size, corner }, uniforms: encode(interior.uniforms), probes });
    }
    for (const [shader, cases] of [[exteriorPortalGLSL, exteriorCases], [interiorPortalGLSL, interiorCases]]) {
      const result = await rasterize(page, shader, cases);
      expect(result.error).toBe(0);
      expect(result.failures).toEqual([]);
    }
  } finally { exterior.dispose(); interior.dispose(); }
});

// Deliberate limit of fixed-route, entry-anchored core growth: a correctly sized
// far-side aperture can straddle a moving grid seam. Closing that overlap would
// obstruct the worm. Keep this case explicit rather than mistaking a diameter
// smaller than one tile for a guarantee of strict single-tile containment.
test('keeps the fixed route open at a shifted-core tile seam without enlarging its aperture', async ({ page }) => {
  const size = 3, zoom = 1.5, passage = makeCorePassage();
  updateCorePassage(passage, {
    entry: { x: 1, y: 2, z: 1, dirKey: 'PY' },
    exit: { x: 0, y: 1, z: 1, dirKey: 'NX' }
  }, size, 0);
  const center = passage.path.midA.clone().multiplyScalar(1 - zoom);
  const half = .2125 * zoom, cell = tunnelCoreScale(size) * zoom;
  const radius = coreOpeningRadius(size, zoom);
  const crossing = wallCrossings(passage.uniforms.uPassagePoints.value, center, half)
    .find(item => item.axis === 'x' && item.point.x < center.x);
  expect(crossing).toBeDefined();
  const point = crossing.point;
  const seam = center.y - half + Math.round((point.y - center.y + half) / cell) * cell;
  expect(Math.abs(point.y - seam)).toBeLessThan(radius / 20);
  expect(radius * 2).toBeLessThan(tunnelDockWidth(size) * zoom);
  passage.uniforms.uCoreRoomCenter.value.copy(center);
  passage.uniforms.uPassageRadius.value = radius;
  const probes = [{ point: point.toArray(), open: true, kind: 'fixed-route' }];
  for (const sign of [-1, 1]) {
    const across = point.clone(); across.y = seam + sign * radius * .4;
    probes.push({ point: across.toArray(), open: true, kind: 'intentional-seam-straddle' });
    const beyond = point.clone(); beyond.y += sign * radius * 1.1;
    probes.push({ point: beyond.toArray(), open: false, kind: 'bounded-radius' });
  }
  const result = await rasterize(page, corePassageGLSL, [{ label: '3x3-zoom1.5-seam', uniforms: encode(passage.uniforms), probes }]);
  expect(result.error).toBe(0);
  expect(result.failures).toEqual([]);
});

// The full live-pair ceiling plus several older tail passages must fit in WebGL1
// without uniform arrays, float textures, or losing the last pair's apertures.
test('opens every live and retained mouth with bounded mobile shader uniforms', async ({ page }) => {
  const interior = makeInteriorPortals(), cases = [];
  const tunnels = Array.from({ length: 14 }, (_, i) => ({
    entry: { x: 1 + i % 7 * 2, y: 14, z: i < 7 ? 3 : 10, dirKey: 'PY' },
    exit: { x: 1 + i % 7 * 2, y: 0, z: i < 7 ? 3 : 10, dirKey: 'NY' },
    padHeight: WORM_PAD_HEIGHT, padExpansion: 0
  }));
  try {
    for (const routes of [tunnels, tunnels.slice(2), tunnels.slice(0, 1), []]) {
      syncInteriorPortals(interior, routes, 15, 0);
      const probes = [];
      for (let i = 0; i < tunnels.length * 2; i++) {
        // Current slots move when a pair heals; inactive stale texels must not cut.
        const center = interior.centers[i];
        probes.push({ point: center.toArray(), open: i < routes.length * 2 || routes.some((_, j) =>
          interior.centers[j * 2].distanceTo(center) < .01 || interior.centers[j * 2 + 1].distanceTo(center) < .01), kind: 'mouth-center' });
        const neighbor = center.clone(); neighbor.x += .34;
        probes.push({ point: neighbor.toArray(), open: false, kind: 'outside-circle' });
      }
      cases.push({ label: `${routes.length} pairs`, uniforms: encode(interior.uniforms), probes });
    }
    const result = await rasterize(page, interiorPortalGLSL, cases);
    expect(result.error).toBe(0);
    expect(result.failures).toEqual([]);
    // Two scalars, two face-count vectors and one sampler, independent of pair count.
    expect(result.activeUniforms).toBeLessThanOrEqual(5);
  } finally { interior.dispose(); }
});
