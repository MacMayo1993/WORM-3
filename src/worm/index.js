// src/worm/index.js
// WORM mode exports

export { useWormGame } from './surface/useSurfaceWormGame.js';
export { WormGameLoop } from './surface/SurfaceWormGameLoop.jsx';
export { useTunnelWormGame } from './tunnel/useTunnelWormGame.js';
export { TunnelWormGameLoop } from './tunnel/TunnelWormGameLoop.jsx';
export { WormMode3D } from './render/WormMode3D.jsx';
export { default as WormHUD } from './WormHUD.jsx';
export { default as WormTrail } from './WormTrail.jsx';
export { default as ParityOrbs, OrbCollectEffect } from './ParityOrb.jsx';
export { default as WormCamera, WormOrientationIndicator } from './WormCamera.jsx';
export { default as WormTouchControls } from './WormTouchControls.jsx';
export * from './wormLogic.js';

// Co-op Platformer mode
export { default as PlatformerWormMode } from './PlatformerWormMode.jsx';
