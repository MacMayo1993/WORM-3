import { createContext, useContext } from 'react';

// The WORM body batches (cubieBodyBatches.js) a Cubie draws its shell into, or
// null outside WORM, where each cubie keeps its own body mesh.
export const CubieBodyBatchContext = createContext(null);
export const useCubieBodyBatches = () => useContext(CubieBodyBatchContext);
