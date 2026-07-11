// src/worm/wormClock.js
//
// Shared mutable state written by useWormCrawler's tick (Three.js RAF) and read
// by the pause menu when it mounts. Same pattern as tunnelProgressBridge.
//
// Why not the store: the wormhole countdown changes every frame while crawling,
// but it is only ever DISPLAYED in the pause menu — and the crawler tick bails
// out while paused, so the value is frozen for the entire time it is visible.
// Publishing it through Zustand meant ~10 store writes/sec whose only effect
// was re-running every subscriber's selector across the whole app. A plain
// field write costs nothing and the pause menu reads a mount-time snapshot.
export const wormClock = {
  countdown: 0, // seconds until the next wormhole pair spawns (0 while spawns are off)
};
