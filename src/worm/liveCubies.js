// Shared singleton: CubeAssembly writes refs + size each render;
// ParityOrbs reads them each frame to derive live cubie world positions/quaternions.
// Since CubeAssembly runs at useFrame priority -1 (before the default priority 0),
// orb positions are always computed from already-updated cubie transforms.
export const liveCubies = { refs: null, size: 0 };
