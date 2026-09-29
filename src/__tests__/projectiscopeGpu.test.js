import { readFileSync } from 'node:fs';
import { JSDOM, VirtualConsole } from 'jsdom';
import { afterAll, beforeAll, expect, it, vi } from 'vitest';
import { Color, UnsignedByteType, Vector3, Vector4, WebGLRenderTarget } from 'three';
import { createMotifMotion } from '../projectiscope/gpuMotion.js';
import { createMotifGeometry, GPU_QUALITY } from '../projectiscope/gpuGeometry.js';
import { createGpuArt } from '../projectiscope/gpuRenderer.js';

let dom, api, initial, errors;
const drawing = vi.fn();
beforeAll(() => {
  errors = [];
  const console = new VirtualConsole(); console.on('jsdomError', e => errors.push(e.message));
  // Use the original CPU implementation as an independent numerical oracle.
  const html = readFileSync('public/projectiscope/index.html', 'utf8').replace('window.__projectiscope={',
    'window.__referenceWorld=()=>{updateWorld();return S.M.strokes.map(s=>Array.from(s.world.slice(0,3*s.n)));};window.__projectiscope={');
  dom = new JSDOM(html, { url: 'http://localhost/projectiscope/index.html#background=1', runScripts: 'dangerously',
    pretendToBeVisual: true, virtualConsole: console,
    beforeParse(w) {
      w.matchMedia = () => ({ matches: false }); w.ResizeObserver = class { observe() {} disconnect() {} };
      w.requestAnimationFrame = vi.fn();
      Object.defineProperty(w.HTMLElement.prototype, 'clientWidth', { get: () => 1024 });
      w.HTMLCanvasElement.prototype.toDataURL = () => 'data:image/jpeg;base64,YQ==';
      w.HTMLCanvasElement.prototype.getContext = function () {
        return new Proxy({ canvas: this, measureText: () => ({ width: 10 }), createRadialGradient: () => ({ addColorStop() {} }),
          createLinearGradient: () => ({ addColorStop() {} }) }, { get: (o, p) => p in o ? o[p] : drawing });
      };
    } });
  api = dom.window.__projectiscope; initial = JSON.parse(atob(api.recipe()));
});
afterAll(() => dom.window.close());
const modelFor = patch => {
  api.applyRecipe(btoa(JSON.stringify({ ...initial, ...patch })));
  return structuredClone(api.gpuBackground().model);
};
function renderer() {
  let target = new WebGLRenderTarget(64, 64), viewport = new Vector4(3, 4, 50, 60), scissor = new Vector4(6, 7, 40, 30);
  let color = new Color('#123456'), alpha = .3, scissorTest = true;
  const gl = {
    domElement: document.createElement('canvas'), autoClear: true, xr: { enabled: true },
    getRenderTarget: () => target, getActiveCubeFace: () => 2, getActiveMipmapLevel: () => 1,
    setRenderTarget: vi.fn(t => { target = t; }), getViewport: out => out.copy(viewport), setViewport: v => { viewport = v.clone(); },
    getScissor: out => out.copy(scissor), setScissor: v => { scissor = v.clone(); },
    getScissorTest: () => scissorTest, setScissorTest: x => { scissorTest = x; },
    getClearColor: out => out.copy(color), getClearAlpha: () => alpha,
    setClearColor: (c, a) => { color = new Color(c); alpha = a; }, clear: vi.fn(), render: vi.fn(),
  };
  gl.state = () => ({ target, viewport: viewport.toArray(), scissor: scissor.toArray(), color: color.toArray(), alpha, scissorTest,
    autoClear: gl.autoClear, xr: gl.xr.enabled });
  return gl;
}

it('exports the exact seeded group/curves and matches the original motion at multiple times', () => {
  for (const t of [0, 7.25, 102]) {
    const model = modelFor({ grp: 'I', dens: 24, seed: 651, t, kinds: { spiral: true, rose: true, wave: true, petal: true, hook: true, dots: true } });
    expect(model.groups).toHaveLength(60); expect(model.strokes).toHaveLength(24);
    const reference = dom.window.__referenceWorld(), motion = createMotifMotion(model); motion.update(t);
    model.strokes.forEach((stroke, id) => {
      const turn = motion.turns[id];
      for (const i of [0, Math.floor(stroke.u.length / 2), stroke.u.length - 1]) {
        const du = (stroke.u[i] - stroke.cu) * turn.z, dv = (stroke.v[i] - stroke.cv) * turn.z;
        const u = stroke.cu + turn.x * du - turn.y * dv, v = stroke.cv + turn.y * du + turn.x * dv;
        const radius = Math.hypot(u, v) * model.recipe.reach;
        const k = radius < 1e-9 ? model.recipe.reach : Math.sin(radius) * model.recipe.reach / radius;
        const point = motion.center.clone().multiplyScalar(Math.cos(radius)).addScaledVector(motion.first, k * u).addScaledVector(motion.second, k * v);
        expect(point.distanceTo(new Vector3(...reference[id].slice(3 * i, 3 * i + 3)))).toBeLessThan(1e-9);
      }
    });
  }
  expect(errors).toEqual([]); expect(dom.window.requestAnimationFrame).not.toHaveBeenCalled();
});

it.each(['O', 'T', 'I', 'D', 'C'])('bounds dense %s artwork while retaining all symmetry copies', group => {
  const model = modelFor({ grp: group, n: 16, dens: 24, fill: .8, kinds: { rose: true, petal: true }, mode: 'parity', phi: 0 });
  for (const quality of Object.values(GPU_QUALITY)) {
    const geometry = createMotifGeometry(model, quality);
    expect(geometry.instanceCount).toBe(model.groups.length * 2);
    expect(geometry.userData.triangles).toBeLessThanOrEqual(quality.triangles);
    expect(Object.keys(geometry.attributes)).toHaveLength(8); // WebGL1 minimum
    for (const attribute of Object.values(geometry.attributes)) expect(Array.from(attribute.array).every(Number.isFinite)).toBe(true);
    // Both sheet representatives share the same group transform.
    const g0 = geometry.attributes.group0, g1 = geometry.attributes.group1;
    expect(Array.from(g0.array.slice(0, 3))).toEqual(Array.from(g0.array.slice(4, 7)));
    expect([g1.array[3], g1.array[7]]).toEqual([1, -1]);
    geometry.dispose();
  }
});

it('keeps every dot and supports motifs hidden behind the custom drawing', () => {
  const model = modelFor({ grp: 'I', dens: 24, kinds: { dots: true } });
  const geometry = createMotifGeometry(model, GPU_QUALITY.reduced);
  expect(geometry.index.count).toBe(model.strokes.reduce((n, s) => n + s.u.length * 6, 0));
  expect(geometry.userData.triangles).toBeLessThanOrEqual(GPU_QUALITY.reduced.triangles); geometry.dispose();
  model.recipe.showMotif = false;
  const empty = createMotifGeometry(model, GPU_QUALITY.normal); expect(empty.index.count).toBe(0); empty.dispose();
});

it('animates with immutable buffers, restores renderer state, pauses, and lowers GPU cost without stopping motion', () => {
  const model = modelFor({ speed: 1, trail: .6 }), gl = renderer(), state = gl.state();
  const art = createGpuArt(gl, model), canvasCalls = drawing.mock.calls.length;
  art.update(0, 0, false, false);
  expect(gl.state()).toEqual(state);
  const mesh = gl.render.mock.calls[0][0].children[0], versions = Object.values(mesh.geometry.attributes).map(a => a.version);
  const turn = mesh.material.uniforms.turns.value[0].clone(), firstTexture = art.texture;
  art.update(1000, 1, false, false);
  expect(art.texture).not.toBe(firstTexture); expect(mesh.material.uniforms.turns.value[0].equals(turn)).toBe(false);
  expect(Object.values(mesh.geometry.attributes).map(a => a.version)).toEqual(versions);
  expect(drawing).toHaveBeenCalledTimes(canvasCalls);
  const calls = gl.render.mock.calls.length;
  expect(art.update(2000, 1, true, false)).toBe(false); expect(gl.render).toHaveBeenCalledTimes(calls);
  const previousGeometry = mesh.geometry, disposed = vi.spyOn(previousGeometry, 'dispose');
  art.update(2016, 1, true, true); expect(disposed).toHaveBeenCalledOnce();
  expect(art.stats.size).toBe(384); expect(art.stats.targetBytes).toBe(3 * 384 * 384 * 4);
  const reducedCalls = gl.render.mock.calls.length;
  expect(art.update(2032, 1.016, false, true)).toBe(false); // 30 Hz art, independent 60 Hz dome
  expect(art.update(2050, 1.034, false, true)).toBe(true); expect(gl.render).toHaveBeenCalledTimes(reducedCalls + 2);
  expect(gl.state()).toEqual(state);
  const allocated = [...new Set(gl.setRenderTarget.mock.calls.map(([target]) => target).filter(target => target !== state.target))];
  const disposals = allocated.map(target => vi.spyOn(target, 'dispose'));
  const materialDispose = vi.spyOn(mesh.material, 'dispose');
  art.dispose(); art.dispose(); expect(materialDispose).toHaveBeenCalledOnce();
  expect(disposals).toHaveLength(3); for (const dispose of disposals) expect(dispose).toHaveBeenCalledOnce();
  expect(art.update(3000, 2, false, false)).toBe(false); state.target.dispose();
});

it('restores game/portal state after a render error and rebuilds history after context restoration', () => {
  const gl = renderer(), state = gl.state(), art = createGpuArt(gl, modelFor({ speed: 1 }));
  gl.render.mockImplementationOnce(() => { throw new Error('lost frame'); });
  expect(() => art.update(0, 0, false, false)).toThrow('lost frame'); expect(gl.state()).toEqual(state);
  art.update(20, .02, false, false);
  expect(art.update(40, .02, true, false)).toBe(false);
  gl.domElement.dispatchEvent(new Event('webglcontextrestored'));
  expect(art.update(60, .02, true, false)).toBe(true); expect(gl.state()).toEqual(state);
  art.dispose(); state.target.dispose();
});

it('shares one compact GPU motion atlas across all 60 symmetry copies, without float targets', () => {
  const gl = renderer(); gl.capabilities = { maxVertexTextures: 4 };
  const model = modelFor({ grp: 'I', dens: 24, kinds: { rose: true, petal: true } });
  const art = createGpuArt(gl, model);
  art.update(0, 0, false, false);
  const points = gl.render.mock.calls[0][0].children[0], strokes = gl.render.mock.calls[1][0].children[0];
  expect(points.isPoints).toBe(true); expect(strokes.geometry.instanceCount).toBe(120);
  expect(points.geometry.attributes.position.count).toBeLessThan(24 * 65 * 2 + 1);
  expect(strokes.material.defines.USE_MOTION_ATLAS).toBe(1);
  expect(points.material.uniforms.turns.value).toBe(strokes.material.uniforms.turns.value);
  expect(art.stats.passes).toBe(3); expect(art.stats.size).toBeLessThanOrEqual(384);
  const versions = Object.values(points.geometry.attributes).map(a => a.version);
  art.update(100, .1, false, false);
  expect(Object.values(points.geometry.attributes).map(a => a.version)).toEqual(versions);
  const targets = [...new Set(gl.setRenderTarget.mock.calls.map(([t]) => t).filter(t => t && t !== gl.getRenderTarget()))];
  expect(targets).toHaveLength(4);
  for (const target of targets) { expect(target.texture.type).toBe(UnsignedByteType); expect(target.depthBuffer).toBe(false); }
  art.update(200, .2, false, true); expect(art.stats.size).toBe(256);
  art.dispose(); gl.getRenderTarget().dispose();
});
