// Controlled effect lifecycle workload; gameplay stays paused throughout.
// Uses the same public component props/bridges the game renders, without taking
// an unpredictable route through random pickups and deaths.
() => {
  const W = window.__perf, store = window.__store;
  const state = W.roots.r3f.containerInfo.getState();
  let worm;
  const stack = [W.roots.r3f.current];
  while (stack.length) {
    const f = stack.pop();
    if (f.memoizedProps?.worm?.pendingSpecialFlashRef) worm = f.memoizedProps.worm;
    for (let c = f.child; c; c = c.sibling) stack.push(c);
  }
  if (!worm) throw Error('No live WORM effect bridge');
  store.setState({ wormPaused: true, perfReducedFX: true, setPerfReducedFX: () => {} });
  const originalGetState = store.getState;
  state.setDpr(1);
  const pinDpr = () => { if (state.viewport.dpr !== 1) state.setDpr(1); requestAnimationFrame(pinDpr); };
  requestAnimationFrame(pinDpr);
  const clean = window.__perfMakeCubies(originalGetState().size);
  for (const plane of clean) for (const row of plane) for (const cubie of row)
    for (const sticker of Object.values(cubie.stickers)) { sticker.flips = 0; sticker.curr = sticker.orig; }
  const n = clean.length, middle = Math.floor(n / 2);
  const orbs = Array.from({ length: n }, (_, x) => ({ x, y: 0, z: n - 1, dirKey: 'PZ' }));
  store.setState({ wormPowerups: orbs, wormSpecials: [], wormElementalTheme: null });
  const { buildManifoldGridMap, flipStickerPair } = window.__perfTopology;
  let flipped = clean;
  for (let i = 0; i < 3; i++) flipped = flipStickerPair(flipped, n, middle, middle, n - 1, 'PZ', buildManifoldGridMap(flipped, n));
  W.effectEvent = name => {
    if (name === 'pickup') worm.pendingSpecialFlashRef.current = { type: 'magnet', pos: [0, 0, n / 2 + .3] };
    else if (name === 'wormhole') store.setState({ cubies: structuredClone(flipped) });
    else if (name === 'clear') store.setState({ cubies: structuredClone(clean) });
    else if (name === 'hide-worm') store.setState({ wormGamePhase: 'scrambling' });
    else if (name === 'show-worm') store.setState({ wormGamePhase: 'active' });
    else throw Error(`Unknown event ${name}`);
  };
  W.effectEvent('clear');
  W.attrib = true;
  const owners = () => { if (!W.attrib) return; W.buildOwners(); requestAnimationFrame(owners); };
  requestAnimationFrame(owners);
  return { size: n, orbs: orbs.length, theme: null, reducedFX: true, dpr: 1 };
}
