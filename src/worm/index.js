// src/worm/index.js
// WORM mode exports

export { useWormGame, WormMode3D, WormGameLoop } from './WormMode.jsx';
export { default as WormHUD } from './WormHUD.jsx';
export { default as WormTrail } from './WormTrail.jsx';
export { default as ParityOrbs, OrbCollectEffect } from './ParityOrb.jsx';
export { default as WormCamera, WormOrientationIndicator } from './WormCamera.jsx';
export { default as WormTouchControls } from './WormTouchControls.jsx';
export * from './wormLogic.js';

// Co-op Platformer mode
export { default as PlatformerWormMode } from './PlatformerWormMode.jsx';
