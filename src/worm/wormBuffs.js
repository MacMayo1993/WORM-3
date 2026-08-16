// src/worm/wormBuffs.js
//
// Live buff readout, written by useWormCrawler's tick and read by the HUD's buff
// strip. Same pattern (and same reasoning) as wormClock: a value that changes every
// frame but is only ever DISPLAYED does not belong in Zustand, where each write
// re-runs every subscriber's selector across the whole app.
//
// Ownership is deliberately split:
//   • wormSim owns the authoritative durations (sim.magnetT, sim.rocketActive)
//   • this bridge mirrors them for rendering, one plain field write per frame
//   • the store carries ONLY the mount/unmount transitions the HUD needs
//
// Because the mirror is driven by the sim tick, and the tick bails out while paused
// or mid-tunnel, the displayed countdown freezes exactly when gameplay does. That is
// the property a wall-clock (Date.now) countdown could never get right.
export const wormBuffs = {
  magnetT: 0,        // seconds of magnet reach remaining
  magnetMaxT: 0,     // duration of the active magnet, for the fill fraction
  rocketActive: false,
  elementalT: 0,     // seconds of the active elemental wash remaining
  elementalMaxT: 0,  // duration of the active wash, for the fill fraction
  // The tile the wash was claimed on, {x,y,z,dirKey} or null. Purely a render
  // input: the cube skin sweeps the element outward from it. Mirrored here rather
  // than put in the store because it is read inside a frame loop, and a store write
  // would re-run every subscriber's selector across the whole app for a value only
  // one component looks at.
  elementalOrigin: null,
};

/**
 * Derive everything the HUD strip draws from a buff readout. Pure, so the display
 * rules are testable without mounting React or a Canvas.
 *
 * @param {{magnetT:number, magnetMaxT:number, rocketActive:boolean}} buffs
 */
export function buffReadout(buffs = wormBuffs) {
  const maxT = buffs.magnetMaxT || 0;
  const left = Math.max(0, buffs.magnetT || 0);
  return {
    rocketActive: !!buffs.rocketActive,
    magnetActive: left > 0,
    magnetSeconds: left,
    // Fraction of the CURRENT maximum, so a refresh rescales the fill immediately
    // rather than showing a bar that overflows its old duration.
    magnetFraction: maxT > 0 ? Math.max(0, Math.min(1, left / maxT)) : 0,
  };
}

/** Zero the readout — run reset, death, and mode unmount all go through here. */
export function resetWormBuffs() {
  wormBuffs.magnetT = 0;
  wormBuffs.magnetMaxT = 0;
  wormBuffs.rocketActive = false;
  wormBuffs.elementalT = 0;
  wormBuffs.elementalMaxT = 0;
  wormBuffs.elementalOrigin = null;
}
