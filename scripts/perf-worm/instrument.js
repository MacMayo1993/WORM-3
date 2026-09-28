// Browser init script for scripts/perf-worm/run.mjs. Injected before the app
// loads (Playwright addInitScript), so it sees every WebGL call and every React
// commit from the first frame. Plain script, not a module: it runs in the page.
//
// What it records, per animation frame (window.__perf.frames):
//   script        ms spent inside requestAnimationFrame callbacks (R3F render +
//                 every useFrame, GSAP, HUD paint loops)
//   draw/inst/tris WebGL draw calls, instanced draws, triangles submitted
//   prog/uni      useProgram switches and uniform uploads
//   bufBytes      bytes sent through bufferData/bufferSubData
//   compile/link  shader compiles and program links (each link is a hitch)
//   cDom/cR3f     React commits on the DOM root and the R3F root
//   s             optional snapshot returned by window.__perf.sample()
//
// window.__perf.noDraw = true skips the draw calls themselves while leaving all
// of three.js's per-frame CPU work in place. Under a software GL (SwiftShader in
// CI/containers) that is the only way to see CPU cost: otherwise the frame is
// gated by rasterisation and the JS profile is ~95% "(program)".
(() => {
  const W = (window.__perf = {
    frames: [],
    longtasks: [],
    noDraw: false,
    attrib: false,
    byOwner: {},
    curOwner: null,
    linkLog: [],
    reactOn: false,
    renders: {},
    roots: {},
    sample: null
  });
  const counters = () => ({
    draw: 0, inst: 0, tris: 0, prog: 0, uni: 0, bufData: 0, bufSub: 0, bufBytes: 0,
    tex: 0, texSub: 0, compile: 0, link: 0, cDom: 0, cR3f: 0
  });
  W.c = counters();

  const triangles = (mode, n) => (mode === 4 ? n / 3 : mode === 5 || mode === 6 ? Math.max(0, n - 2) : 0);
  const owned = (t) => {
    if (!W.attrib) return;
    const o = (W.byOwner[W.curOwner || '(outside renderBufferDirect)'] ||= { draws: 0, tris: 0 });
    o.draws++;
    o.tris += t;
  };
  const wrap = (proto) => {
    const tap = (name, fn, isDraw = false) => {
      const orig = proto[name];
      if (!orig) return;
      proto[name] = function (...a) {
        fn(a);
        if (isDraw && W.noDraw) return undefined;
        return orig.apply(this, a);
      };
    };
    tap('drawElements', (a) => { const t = triangles(a[0], a[1]); W.c.draw++; W.c.tris += t; owned(t); }, true);
    tap('drawArrays', (a) => { const t = triangles(a[0], a[2]); W.c.draw++; W.c.tris += t; owned(t); }, true);
    tap('drawElementsInstanced', (a) => { const t = triangles(a[0], a[1]) * a[4]; W.c.draw++; W.c.inst++; W.c.tris += t; owned(t); }, true);
    tap('drawArraysInstanced', (a) => { const t = triangles(a[0], a[2]) * a[3]; W.c.draw++; W.c.inst++; W.c.tris += t; owned(t); }, true);
    tap('useProgram', () => W.c.prog++);
    tap('bufferData', (a) => {
      const bytes = a[1]?.byteLength ?? (typeof a[1] === 'number' ? a[1] : 0);
      W.c.bufData++; W.c.bufBytes += bytes; W.recordUpload?.(a[1], bytes);
    });
    tap('bufferSubData', (a) => {
      W.c.bufSub++;
      const data = a[2], elementSize = data?.BYTES_PER_ELEMENT ?? 1;
      const remaining = (data?.byteLength ?? 0) / elementSize - (a[3] ?? 0);
      const bytes = (a[4] || remaining) * elementSize;
      W.c.bufBytes += bytes; W.recordUpload?.(data, bytes);
    });
    tap('texImage2D', () => W.c.tex++);
    tap('texSubImage2D', () => W.c.texSub++);
    tap('compileShader', () => W.c.compile++);
    tap('linkProgram', () => {
      W.c.link++;
      if (W.attrib) W.linkLog.push({ owner: W.curOwner || '(outside renderBufferDirect)', t: performance.now(), s: W.sample?.() ?? null });
    });
    for (const u of ['uniform1f', 'uniform1i', 'uniform2f', 'uniform3f', 'uniform4f', 'uniform1fv', 'uniform2fv', 'uniform3fv', 'uniform4fv',
      'uniformMatrix3fv', 'uniformMatrix4fv']) tap(u, () => W.c.uni++);
  };
  wrap(WebGL2RenderingContext.prototype);
  wrap(WebGLRenderingContext.prototype);

  // Every rAF callback of one frame receives the same timestamp; a new timestamp
  // closes the previous frame's record.
  const raf = window.requestAnimationFrame.bind(window);
  let lastTs = -1, script = 0, cbs = 0;
  const flush = (ts) => {
    if (lastTs >= 0) {
      const rec = { ts: lastTs, script, cbs, ...W.c };
      if (W.sample) try { rec.s = W.sample(); } catch { rec.s = null; }
      W.frames.push(rec);
      if (W.frames.length > 40000) W.frames.splice(0, 10000);
    }
    lastTs = ts; script = 0; cbs = 0; W.c = counters();
  };
  window.requestAnimationFrame = (cb) => raf((ts) => {
    if (ts !== lastTs) flush(ts);
    const t0 = performance.now();
    try { cb(ts); } finally { script += performance.now() - t0; cbs++; }
  });
  try {
    new PerformanceObserver((list) => {
      for (const e of list.getEntries()) W.longtasks.push({ start: e.startTime, dur: e.duration });
    }).observe({ type: 'longtask', buffered: true });
  } catch { /* longtask unsupported */ }

  // Minimal React DevTools hook: counts commits per root and, when reactOn,
  // which function components actually rendered (PerformedWork flag) in the
  // subtrees the commit touched. Works on development and production builds.
  const renderers = new Map();
  let rendererId = 0;
  const nameOf = (f) => {
    const t = f.type;
    if (!t) return '?';
    return t.displayName || t.name || t.render?.displayName || t.render?.name || t.type?.displayName || t.type?.name || '(anon)';
  };
  const COMPOSITE = new Set([0, 1, 11, 14, 15]);
  const walk = (fiber, rootName) => {
    const stack = [fiber];
    while (stack.length) {
      const f = stack.pop();
      if (COMPOSITE.has(f.tag) && (!f.alternate || (f.flags & 1) === 1)) {
        const key = `${rootName}:${nameOf(f)}${f.alternate ? '' : ' [mount]'}`;
        W.renders[key] = (W.renders[key] || 0) + 1;
      }
      // A child pointer shared with the alternate means React never entered it.
      if (f.alternate && f.alternate.child === f.child && f.tag !== 3) continue;
      for (let c = f.child; c; c = c.sibling) stack.push(c);
    }
  };
  window.__REACT_DEVTOOLS_GLOBAL_HOOK__ = {
    supportsFiber: true,
    renderers,
    inject(r) { renderers.set(++rendererId, r); return rendererId; },
    onCommitFiberRoot(id, root) {
      const name = (renderers.get(id)?.rendererPackageName || 'react-dom').includes('three') ? 'r3f' : 'dom';
      W.roots[name] = root;
      if (name === 'r3f') W.c.cR3f++; else W.c.cDom++;
      if (W.reactOn) try { walk(root.current, name); } catch (e) { W.walkError = String(e); }
    },
    onCommitFiberUnmount() {},
    onPostCommitFiberRoot() {},
    checkDCE() {},
    isDisabled: false
  };
})();
