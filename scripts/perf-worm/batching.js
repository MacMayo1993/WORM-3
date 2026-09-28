// Same-scene reference for draw-count and image comparisons. Restores individual
// meshes from the real TileSurfaceInstance props and the cage's material groups.
// Batch writers keep running in both states, so timings are NOT old-vs-new CPU.
() => {
  const W = window.__perf, store = W.roots.r3f.containerInfo, state = store.getState();
  // Adaptive quality otherwise switches shadow passes between A/B windows.
  // This fixture pins one tier and one DPR for the entire comparison.
  window.__store.setState({ perfReducedFX: true, setPerfReducedFX: () => {} });
  state.setDpr(1);
  const scene = state.scene, sources = [], anchors = new WeakSet(), cages = new Map();
  let Mesh, reference = false;
  scene.traverse(o => { if (o.isMesh && !o.isInstancedMesh && o.type === 'Mesh') Mesh ||= o.constructor; });
  W.refreshBatchReferences = () => {
    W.buildOwners();
    const stack = [W.roots.r3f.current];
    while (stack.length) {
      const fiber = stack.pop();
      if (fiber.type?.name === 'TileSurfaceInstance') {
        const anchor = fiber.child?.stateNode, props = fiber.memoizedProps;
        if (anchor?.isGroup && !anchors.has(anchor)) {
          anchors.add(anchor);
          const material = props.color === undefined ? props.material : props.material.clone();
          if (props.color !== undefined) material.color.set(props.color);
          const mesh = new Mesh(props.geometry, material);
          mesh.name = 'UnbatchedTileReference'; mesh.visible = reference;
          anchor.add(mesh); sources.push({ anchor, mesh, props });
        }
      }
      for (let child = fiber.child; child; child = child.sibling) stack.push(child);
    }
    scene.traverse(o => {
      if (o.name === 'ParityOrbCageBatch' && !cages.has(o)) {
        const rgba = o.geometry.attributes.color;
        const materials = o.geometry.groups.map(group => {
          const material = o.material.clone(), vertex = o.geometry.index.getX(group.start);
          material.vertexColors = false;
          material.color.setRGB(rgba.getX(vertex), rgba.getY(vertex), rgba.getZ(vertex));
          material.opacity = rgba.getW(vertex);
          return material;
        });
        cages.set(o, { material: o.material, materials });
      }
    });
    return { tileSources: sources.filter(s => s.anchor.parent).length, cages: cages.size };
  };
  W.batchReference = on => { reference = on; W.refreshBatchReferences(); };
  W.batchPose = 'overview';
  W.batchDpr = 1;
  W.batchTime = state.clock.elapsedTime;
  // Hold animations on exactly the same clock for paired captures.
  state.clock.getDelta = () => 0;
  const apply = () => {
    if (store.getState().viewport.dpr !== W.batchDpr) state.setDpr(W.batchDpr);
    for (const source of sources) source.mesh.visible = reference;
    for (const [mesh, cage] of cages) mesh.material = reference ? cage.materials : cage.material;
    scene.traverse(o => {
      if (o.name === 'TileSurfaceBatches') o.visible = !reference;
    });
  };
  W.stopBatchReference = state.internal.subscribe({ current: apply }, 0, store);
  // Place the camera before the normal -0.25 chase callback, then again just
  // after it; culling/visibility and rendering all see the same fixture pose.
  const pose = () => {
    const n = window.__store.getState().size, camera = state.camera;
    camera.up.set(0, 1, 0); camera.fov = 50;
    if (W.batchPose === 'inside') { camera.position.set(.15, .2, n * .24); camera.lookAt(0, 0, n); }
    else { camera.position.set(n * 1.0, n * .85, n * 1.35); camera.lookAt(0, 0, 0); }
    camera.updateProjectionMatrix(); camera.updateMatrixWorld(true);
  };
  state.internal.subscribe({ current: pose }, -0.245, store);
  W.refreshBatchReferences();
  return { ...W.refreshBatchReferences(), pose: W.batchPose };
}
