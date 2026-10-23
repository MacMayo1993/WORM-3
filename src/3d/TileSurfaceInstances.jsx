import { CHROME_TILE_FINISH } from './cubeViewStyles.js';
import { createContext, useContext, useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { MeshStandardMaterial } from 'three';
import { createSurfaceBatches } from './surfaceBatches.js';
import { useGameStore } from '../hooks/useGameStore.js';

const Context = createContext(null);
export const useTileSurfaceInstances = () => useContext(Context);

export function TileSurfaceProvider({ children, exteriorPortals }) {
  const pool = useMemo(() => ({
    ...createSurfaceBatches(2048, exteriorPortals?.materialFor),
    // Flat transparent marks laid on tiles (the worm's footprint), one draw per look.
    decals: createSurfaceBatches(2048, exteriorPortals?.materialFor, { transparent: true }),
    chromeMaterial: new MeshStandardMaterial(CHROME_TILE_FINISH),
    backMaterial: new MeshStandardMaterial({ color: '#ffffff', roughness: 0.45, metalness: 0.08 })
  }), [exteriorPortals]);
  useLayoutEffect(() => () => { pool.dispose(); pool.decals.dispose(); pool.backMaterial.dispose(); pool.chromeMaterial.dispose(); }, [pool]);
  // Child transform writers register before this provider at priority zero;
  // cubie rotation, raised pads and live expansion already ran at negative priorities.
  // PiP and live portal views render other cameras; keep their tiles available.
  useFrame(({ camera }) => {
    const state = useGameStore.getState();
    const view = state.showAntipodalPiP || state.settings?.livePortalViews === true ? null : camera;
    pool.update(view);
    pool.decals.update(view);
  });
  return <Context.Provider value={pool}>
    {children}
    <primitive object={pool.group} />
    <primitive object={pool.decals.group} />
  </Context.Provider>;
}

// `seed` is a stable number per piece, read by the material as aInstanceSeed, and
// `data` four numbers read as aInstanceData (instanced draws only).
export function TileSurfaceInstance({ geometry, material, color, seed, data, ...props }) {
  const pool = useTileSurfaceInstances(), anchor = useRef();
  const colorRef = useRef(color), seedRef = useRef(seed), dataRef = useRef(data);
  colorRef.current = color;
  seedRef.current = seed;
  dataRef.current = data;
  const hasColor = color !== undefined, hasSeed = seed !== undefined, hasData = data !== undefined;
  useLayoutEffect(() => pool?.register(anchor.current, geometry, material, hasColor ? colorRef : null, hasSeed ? seedRef : null,
    hasData ? dataRef : null), [pool, geometry, material, hasColor, hasSeed, hasData]);
  return pool ? <group ref={anchor} {...props} />
    : <mesh geometry={geometry} material={material} dispose={null} {...props} />;
}
