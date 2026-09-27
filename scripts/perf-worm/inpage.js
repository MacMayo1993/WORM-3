// Evaluated in the page by run.mjs once a WORM run is active: `(${source})()`.
// Needs instrument.js to have been injected first (window.__perf, the React
// hook that captured the R3F root). Installs, all off until switched on:
//
//   attribution  every draw is labelled "<component>><component> :: geometry/material"
//                from the React fiber that created the object (nearest ancestor for
//                imperatively created children)
//   churn        detects draws that sent three.js back through program selection
//                (material.version bumps, lights/env/instancing changes) — each one
//                is a getParameters + cache-key build, and a link if the key is new
//   uploads      attribute-version diffing: which BufferAttributes re-upload, bytes
//   patches      A/B toggles used to price the audit's recommendations:
//                  A  transparent DoubleSide materials render in one pass
//                  B  instanced attributes upload only the live instance range
//                  C  hidden subtrees skip matrixWorld updates
//                  D  inward-facing antipodal sticker backs hidden (camera outside)
() => {
  const W = window.__perf;
  const state = W.roots.r3f.containerInfo.getState();
  W.gl = state.gl;
  W.scene = state.scene;
  const gl = W.gl;

  // ── Ownership: THREE object → owning React components ──────────────────────
  const COMPOSITE = new Set([0, 1, 11, 14, 15]);
  const GENERIC = /^(\(anon\)|Suspense|Fragment|ForwardRef|memo|Memo|\?)$/;
  const nameOf = (f) => {
    const t = f.type;
    if (!t) return '?';
    return t.displayName || t.name || t.render?.displayName || t.render?.name || t.type?.displayName || t.type?.name || '(anon)';
  };
  W.buildOwners = () => {
    const owners = new WeakMap();
    const stack = [[W.roots.r3f.current, []]];
    while (stack.length) {
      const [f, chain] = stack.pop();
      let next = chain;
      if (COMPOSITE.has(f.tag)) { const n = nameOf(f); if (!GENERIC.test(n)) next = chain.concat(n); }
      if (f.tag === 5 && f.stateNode?.isObject3D) owners.set(f.stateNode, next.slice(-2).join('>'));
      for (let c = f.child; c; c = c.sibling) stack.push([c, next]);
    }
    W.owners = owners;
  };
  W.buildOwners();
  W.ownerOf = (o) => {
    for (let x = o; x; x = x.parent) { const n = W.owners.get(x); if (n) return n; }
    return '(no React owner)';
  };
  const label = (object, geometry, material) =>
    `${W.ownerOf(object)} :: ${object.isInstancedMesh ? 'Inst ' : ''}${geometry?.type || ''}/${material?.type || ''}`;

  // ── renderBufferDirect wrapper: labels + program-selection churn ───────────
  const props = gl.properties;
  const FIELDS = ['__version', 'lightsStateVersion', 'outputColorSpace', 'instancing', 'instancingColor', 'envMap', 'fog',
    'vertexAlphas', 'vertexTangents', 'numClippingPlanes', 'toneMapping', 'currentProgram'];
  W.churn = {};
  W.churnOn = false;
  const rbd = gl.renderBufferDirect;
  gl.renderBufferDirect = function (camera, scene, geometry, material, object, group) {
    if (!W.attrib && !W.churnOn) return rbd.call(this, camera, scene, geometry, material, object, group);
    const depth = material && (material.isMeshDepthMaterial || material.isMeshDistanceMaterial);
    W.curOwner = (depth ? '[shadow] ' : '') + label(object, geometry, material);
    const mp = W.churnOn && material ? props.get(material) : null;
    const before = mp ? FIELDS.map((f) => mp[f]) : null;
    try {
      return rbd.call(this, camera, scene, geometry, material, object, group);
    } finally {
      if (mp) {
        const changed = FIELDS.filter((f, i) => before[i] !== mp[f]);
        if (changed.length) {
          const first = before[FIELDS.length - 1] === undefined;
          const why = first ? 'first use' : changed.filter((c) => c !== 'currentProgram').join('+') || 'program';
          const key = `${W.curOwner} => ${why}${changed.includes('currentProgram') ? ' [program switch]' : ''}`;
          W.churn[key] = (W.churn[key] || 0) + 1;
        }
      }
      W.curOwner = null;
    }
  };
  W.passes = {};
  const render = gl.render;
  gl.render = function (scene, camera) {
    if (W.attrib) {
      const k = `${gl.getRenderTarget() ? 'render target' : 'screen'} ${scene === W.scene ? 'main scene' : scene.name || scene.type} / ${camera.type}`;
      W.passes[k] = (W.passes[k] || 0) + 1;
    }
    return render.call(this, scene, camera);
  };

  // ── Upload attribution by attribute version ────────────────────────────────
  const versions = new WeakMap();
  W.uploads = {};
  W.trackUploads = (armed) => {
    W.scene.traverse((o) => {
      const g = o.geometry;
      if (!g?.attributes) return;
      const owner = label(o, g, null);
      const check = (name, a) => {
        if (!a?.array) return;
        const prev = versions.get(a);
        versions.set(a, a.version);
        if (!armed || prev === a.version) return;
        const range = a._updateRange?.count > 0 ? a._updateRange.count * a.array.BYTES_PER_ELEMENT : a.array.byteLength;
        const u = (W.uploads[`${owner} .${name}${prev === undefined ? ' [new]' : ''}`] ||= { n: 0, bytes: 0 });
        u.n++;
        u.bytes += range;
      };
      for (const [n, a] of Object.entries(g.attributes)) check(n, a);
      if (g.index) check('index', g.index);
      if (o.isInstancedMesh) { check('instanceMatrix', o.instanceMatrix); check('instanceColor', o.instanceColor); }
    });
  };

  // ── A/B patches ────────────────────────────────────────────────────────────
  W.patch = { A: false, B: false, C: false, D: false };
  const savedRange = new WeakMap();
  const liveRange = (attr, mesh, itemSize, on) => {
    if (!attr) return;
    if (on && !savedRange.has(attr)) {
      savedRange.set(attr, attr._updateRange);
      Object.defineProperty(attr, '_updateRange', {
        configurable: true, get: () => ({ offset: 0, count: Math.max(0, mesh.count) * itemSize }), set() {}
      });
    } else if (!on && savedRange.has(attr)) {
      Object.defineProperty(attr, '_updateRange', { configurable: true, writable: true, value: savedRange.get(attr) });
      savedRange.delete(attr);
    }
  };
  W.applyPatches = () => {
    const { A, B, C, D } = W.patch;
    W.scene.traverse((o) => {
      for (const m of o.material ? [].concat(o.material) : []) {
        if (m.transparent && m.side === 2) {
          if (m.__fsp === undefined) m.__fsp = m.forceSinglePass;
          m.forceSinglePass = A ? true : m.__fsp;
        }
      }
      if (o.isInstancedMesh) {
        liveRange(o.instanceMatrix, o, 16, B);
        liveRange(o.instanceColor, o, 3, B);
        for (const a of Object.values(o.geometry.attributes)) if (a.isInstancedBufferAttribute) liveRange(a, o, a.itemSize, B);
      }
      if (o.__mwau === undefined) o.__mwau = o.matrixWorldAutoUpdate;
      o.matrixWorldAutoUpdate = C && !o.visible ? false : o.__mwau;
      if (o.name === 'sticker-antipodal-back') {
        if (o.__vis === undefined) o.__vis = o.visible;
        o.visible = D ? false : o.__vis;
      }
    });
  };
  clearInterval(W.patchTimer);
  W.patchTimer = setInterval(() => W.applyPatches(), 400);

  return { programs: gl.info.programs.length, geometries: gl.info.memory.geometries, textures: gl.info.memory.textures };
}
