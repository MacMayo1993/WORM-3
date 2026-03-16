// src/worm/WormMode.jsx
// Re-export barrel — implementation has been split into mode-specific modules:
//   surface hook/loop → worm/surface/
//   tunnel hook/loop  → worm/tunnel/
//   shared render     → worm/render/

export { useWormGame, CONFIG } from './surface/useSurfaceWormGame.js';
export { SurfaceWormGameLoop, WormGameLoop } from './surface/SurfaceWormGameLoop.jsx';
export { useTunnelWormGame, TUNNEL_CONFIG } from './tunnel/useTunnelWormGame.js';
export { TunnelWormGameLoop } from './tunnel/TunnelWormGameLoop.jsx';
export { WormMode3D } from './render/WormMode3D.jsx';
