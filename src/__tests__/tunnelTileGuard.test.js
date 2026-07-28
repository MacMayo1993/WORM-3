import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { makeTileGuard, setTileGuard, tileRoom } from '../manifold/tunnelTileGuard.js';
import { SURFACE_OFFSET, TUNNEL_ANCHOR_OFFSET } from '../utils/constants.js';

// Ribbon geometry constants, mirrored from MobiusTunnel so the budget these
// tests check is the one the renderer actually spends.
const RIBBON_WIDTH = 0.85;
const BUMPER_HEIGHT = 0.30;
const TAPER_MIN = 0.15;
const MINI_FACE_R = 0.25;

const V = (x, y, z) => new THREE.Vector3(x, y, z);

/** Anchor + outward normal for the middle-ish tile of a face on an n-cube. */
function mouth(size, dirKey, a, b) {
  const k = (size - 1) / 2;
  const n = {
    PX: V(1, 0, 0), NX: V(-1, 0, 0),
    PY: V(0, 1, 0), NY: V(0, -1, 0),
    PZ: V(0, 0, 1), NZ: V(0, 0, -1)
  }[dirKey];
  const centre = V(0, 0, 0);
  if (dirKey === 'PX' || dirKey === 'NX') centre.set(n.x * k, a - k, b - k);
  else if (dirKey === 'PY' || dirKey === 'NY') centre.set(a - k, n.y * k, b - k);
  else centre.set(a - k, b - k, n.z * k);
  return { anchor: centre.clone().addScaledVector(n, TUNNEL_ANCHOR_OFFSET), n, centre };
}

describe('tileRoom', () => {
  it('is zero at each anchor and positive inward', () => {
    const g = makeTileGuard();
    const A = mouth(3, 'PY', 2, 0);
    const B = mouth(3, 'NY', 0, 2);
    setTileGuard(g, A.anchor, A.n, B.anchor, B.n);

    expect(tileRoom(g, A.anchor.x, A.anchor.y, A.anchor.z)).toBeCloseTo(0, 6);
    expect(tileRoom(g, B.anchor.x, B.anchor.y, B.anchor.z)).toBeCloseTo(0, 6);
    // The core is as far from both tiles as anything on the path gets.
    expect(tileRoom(g, 0, 0, 0)).toBeGreaterThan(1.0);
  });

  it('never returns a negative budget, even outside the cube', () => {
    const g = makeTileGuard();
    const A = mouth(3, 'PY', 1, 1);
    const B = mouth(3, 'NY', 1, 1);
    setTileGuard(g, A.anchor, A.n, B.anchor, B.n);
    expect(tileRoom(g, 0, 99, 0)).toBe(0);
    expect(tileRoom(g, 0, -99, 0)).toBe(0);
  });
});

// The bug this guard exists for: a pair whose two tiles sit on DIFFERENT axes
// gives the ribbon a surface normal that leans out of the face, so the guard
// rails standing off it broke through the sticker. Walk the real path and
// assert the budgeted geometry stays behind both stickers.
describe('tunnel geometry stays behind its own stickers', () => {
  const SEGS = 40;

  /** Replays MobiusTunnel's centreline and clamps, returning the worst breach. */
  function worstBreach(size, endA, endB, { clamp = true, pulse = 1 } = {}) {
    const g = makeTileGuard();
    setTileGuard(g, endA.anchor, endA.n, endB.anchor, endB.n);

    const midA = endA.n.clone().multiplyScalar(MINI_FACE_R);
    const midB = endB.n.clone().multiplyScalar(MINI_FACE_R);
    const axis = endB.anchor.clone().sub(endA.anchor).normalize();

    const perpBase = new THREE.Vector3().crossVectors(axis, endA.n);
    if (perpBase.lengthSq() < 0.001) perpBase.crossVectors(axis, V(0, 1, 0));
    if (perpBase.lengthSq() < 0.001) perpBase.crossVectors(axis, V(0, 0, 1));
    perpBase.normalize();

    const tanA = midA.clone().sub(endA.anchor).normalize();
    const tanB = endB.anchor.clone().sub(midB).normalize();

    // Surface of the cube along each end's axis. Anything beyond this is
    // in front of the sticker and visible through it.
    const shell = (size - 1) / 2 + SURFACE_OFFSET;
    let worst = -Infinity;
    const probe = (p) => {
      worst = Math.max(worst, p.dot(endA.n) - shell, p.dot(endB.n) - shell);
    };

    const half = SEGS / 2;
    for (let i = 0; i <= SEGS; i++) {
      const t = i / SEGS;
      const taper = TAPER_MIN + (1 - TAPER_MIN) * Math.abs(2 * t - 1);
      let w = (RIBBON_WIDTH / 2) * taper * pulse;
      let bh = BUMPER_HEIGHT * taper;

      const c = i <= half
        ? endA.anchor.clone().lerp(midA, i / half)
        : midB.clone().lerp(endB.anchor, (i - half) / half);

      if (clamp) {
        const room = tileRoom(g, c.x, c.y, c.z);
        if (w > room) w = room;
        const railRoom = room - w;
        if (bh > railRoom) bh = railRoom;
      }

      const perp = perpBase.clone().applyAxisAngle(axis, t * Math.PI);
      const tan = i <= half ? tanA : tanB;
      const nrm = new THREE.Vector3().crossVectors(tan, perp);
      if (nrm.lengthSq() < 0.001) nrm.crossVectors(V(0, 1, 0), perp);
      nrm.normalize();

      for (const sign of [-1, 1]) {
        const edge = c.clone().addScaledVector(perp, sign * w);
        probe(edge);
        probe(edge.clone().addScaledVector(nrm, bh));
      }
    }
    return worst;
  }

  // Every cross-axis mouth pairing on a 3×3, including the off-centre tiles
  // whose arms run obliquely — those are the ones that leaned out.
  const crossPairs = [];
  for (const d1 of ['PY', 'NY', 'PX', 'NX', 'PZ', 'NZ']) {
    for (const d2 of ['PY', 'NY', 'PX', 'NX', 'PZ', 'NZ']) {
      if (d1[1] === d2[1]) continue; // same axis
      for (const a of [0, 1, 2]) for (const b of [0, 1, 2]) {
        crossPairs.push([d1, a, b, d2, 2 - a, 2 - b]);
      }
    }
  }

  it('reproduces the breach when the clearance budget is not applied', () => {
    let breached = 0;
    for (const [d1, a1, b1, d2, a2, b2] of crossPairs) {
      const w = worstBreach(3, mouth(3, d1, a1, b1), mouth(3, d2, a2, b2), { clamp: false });
      if (w > 1e-6) breached++;
    }
    // Not all of them — which is exactly why this showed up on *some* tiles.
    expect(breached).toBeGreaterThan(0);
    expect(breached).toBeLessThan(crossPairs.length);
  });

  it('holds every cross-axis pair behind both stickers once budgeted', () => {
    for (const [d1, a1, b1, d2, a2, b2] of crossPairs) {
      const w = worstBreach(3, mouth(3, d1, a1, b1), mouth(3, d2, a2, b2));
      expect(w).toBeLessThanOrEqual(1e-9);
    }
  });

  it('holds same-axis pairs too', () => {
    for (const [d1, d2] of [['PY', 'NY'], ['PX', 'NX'], ['PZ', 'NZ']]) {
      for (const a of [0, 1, 2]) for (const b of [0, 1, 2]) {
        const w = worstBreach(3, mouth(3, d1, a, b), mouth(3, d2, 2 - a, b));
        expect(w).toBeLessThanOrEqual(1e-9);
      }
    }
  });

  it('holds while a tile is mid-flip and the band is swelling', () => {
    // flipWidthPulse peaks at 1 + 0.55 on the flipping end.
    for (const [d1, a1, b1, d2, a2, b2] of crossPairs) {
      const w = worstBreach(3, mouth(3, d1, a1, b1), mouth(3, d2, a2, b2), { pulse: 1.55 });
      expect(w).toBeLessThanOrEqual(1e-9);
    }
  });

  it('holds on every supported cube size', () => {
    for (const size of [2, 3, 4, 5]) {
      const last = size - 1;
      const w = worstBreach(size, mouth(size, 'PY', 0, 0), mouth(size, 'NX', last, last));
      expect(w).toBeLessThanOrEqual(1e-9);
    }
  });

  it('still gives the band room to open out away from the mouths', () => {
    // Containment must not have flattened the ribbon everywhere — the budget is
    // only supposed to bite near the tiles.
    const g = makeTileGuard();
    const A = mouth(3, 'PY', 0, 0);
    const B = mouth(3, 'NX', 2, 2);
    setTileGuard(g, A.anchor, A.n, B.anchor, B.n);
    const midA = A.n.clone().multiplyScalar(MINI_FACE_R);
    const quarter = A.anchor.clone().lerp(midA, 0.5);
    expect(tileRoom(g, quarter.x, quarter.y, quarter.z)).toBeGreaterThan(RIBBON_WIDTH / 2);
  });
});
