import { createContext, forwardRef, useContext, useLayoutEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { isMobile } from '../utils/device.js';
import { createWormLightPool, createWormLightSource } from './wormLightPool.js';

const LightingContext = createContext(null);

export function WormLighting({ children }) {
  const pool = useMemo(() => createWormLightPool(isMobile ? 2 : 4), []);
  // Child orb animators register first at priority zero. Copy their current
  // positions/fades afterwards, without taking over R3F's renderer.
  useFrame(({ camera }) => pool.update(camera.position));
  return <LightingContext.Provider value={pool}>
    {children}
    <primitive object={pool.group} />
  </LightingContext.Provider>;
}

export const WormPointLight = forwardRef(function WormPointLight(props, ref) {
  const pool = useContext(LightingContext);
  const source = useMemo(() => createWormLightSource(), []);
  useLayoutEffect(() => pool?.register(source), [pool, source]);
  // ParityOrbs is also used outside WORM, where its existing light is retained.
  return pool ? <primitive object={source} ref={ref} {...props} /> : <pointLight ref={ref} {...props} />;
});
