// wormTurnBridge.js
// Lightweight module-level callback bridge that lets the DOM overlay (WormCrawlerHUD)
// call queueTurn() on the R3F canvas-side worm without routing through Zustand state.
// Using Zustand for this was an anti-pattern: it stores a function in reactive state,
// causing unnecessary subscriber notifications and obscuring the data flow.

let _cb = null;

/** Called once by HealerWormMode3DWrapper when the worm hook mounts/remounts. */
export const setWormTurnCallback = (fn) => { _cb = fn; };

/**
 * Called by WormCrawlerHUD's thumb tray: 'turnLeft' / 'turnRight' from the two
 * steering keys, plus 'jump' and 'boost'. Safe to call when unmounted (_cb is null).
 */
export const callWormTurn = (dir) => _cb?.(dir);
