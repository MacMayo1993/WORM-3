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
    backMaterial: new MeshStandardMaterial({ color: '#ffffff', roughness: 0.45, metalness: 0.08 })
  }), [exteriorPortals]);
  useLayoutEffect(() => () => { pool.dispose(); pool.backMaterial.dispose(); }, [pool]);
  // Child transform writers register before this provider at priority zero;
  // cubie rotation, raised pads and live expansion already ran at negative priorities.
  // PiP and live portal views render other cameras; keep their tiles available.
  useFrame(({ camera }) => {
    const state = useGameStore.getState();
    pool.update(state.showAntipodalPiP || state.settings?.livePortalViews === true ? null : camera);
  });
  return <Context.Provider value={pool}>
    {children}
    <primitive object={pool.group} />
  </Context.Provider>;
}

export function TileSurfaceInstance({ geometry, material, color, ...props }) {
  const pool = useTileSurfaceInstances(), anchor = useRef();
  const colorRef = useRef(color);
  colorRef.current = color;
  const hasColor = color !== undefined;
  useLayoutEffect(() => pool?.register(anchor.current, geometry, material, hasColor ? colorRef : null),
    [pool, geometry, material, hasColor]);
  return pool ? <group ref={anchor} {...props} />
    : <mesh geometry={geometry} material={material} dispose={null} {...props} />;
}
