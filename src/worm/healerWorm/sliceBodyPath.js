import * as THREE from 'three';
import { shAt } from '../circularBuffers.js';
import { BASE_TAIL_LENGTH, BODY_BALL_SPACING, WORM_LIFT } from './constants.js';
import { inchGaitInto } from './inchGait.js';

const head = new THREE.Vector3();
const gaitPoint = { dist: 0, arch: 0 };
const EPS = 1e-9;
// Keep a bead's radius on the head side of the opening, not straddling it.
export const SLICE_CUT_CLEARANCE = 0.09;

export function bodyDistanceAt(worm, index) {
  const gait = worm.bodyGait?.current;
  return gait?.enabled
    ? inchGaitInto(gaitPoint, index, worm.tailLength.current, gait.phase, gait.move, gait.shape).dist
    : index * BODY_BALL_SPACING;
}

// Same centre-line anchor used by WormBody. Surface history already contains
// its lift; only the live head needs that offset added here.
export function bodyPathHeadInto(out, worm, transit = false) {
  out.copy(worm.headInterpPos.current);
  const lift = WORM_LIFT + (worm.isJumping?.current ? Math.sin(worm.jumpT.current * Math.PI) * 0.55 : 0);
  return out.addScaledVector(worm.currentNormal.current, transit ? 0 : lift);
}

/** Find the first separation along the occupied path, not along visited tiles.
 * Called once when a new turn starts, before any slice transform is applied.
 * Includes the live-head/history bracket and clips sparse brackets analytically.
 */
export function findSlicePathHit(worm, axis, layer, size) {
  const history = worm.stepHistory?.current;
  if (!history?.count || !worm.headInterpPos?.current || !worm.currentNormal?.current) return null;
  const coord = axis === 'col' ? 'x' : axis === 'row' ? 'y' : 'z';
  const k = (size - 1) / 2;
  // An outward-facing bead still belongs to the outermost cubie layer.
  const low = layer === 0 ? -Infinity : layer - k - 0.5;
  const high = layer === size - 1 ? Infinity : layer - k + 0.5;
  const planes = [low, high];
  let a = bodyPathHeadInto(head, worm);
  const headOnLayer = a[coord] >= low && a[coord] <= high;
  const reach = bodyDistanceAt(worm, worm.tailLength.current - 1);
  let distance = 0;
  let previous = null;
  for (let i = 0; i < history.count && distance <= reach; i++) {
    const record = shAt(history, i);
    const b = record.pos;
    const length = a.distanceTo(b);
    const change = b[coord] - a[coord];
    let t = Infinity;
    if (length > EPS && Math.abs(change) > EPS && !record.transit && !previous?.transit) {
      for (const plane of planes) {
        const at = (plane - a[coord]) / change;
        if (at >= -EPS && at <= 1 + EPS) t = Math.min(t, Math.max(0, Math.min(1, at)));
      }
    }
    const cutDistance = distance + length * t;
    if (Number.isFinite(t) && cutDistance <= reach + EPS) {
      const safeDistance = Math.max(0, cutDistance - SLICE_CUT_CLEARANCE);
      // Gait distances are monotonic, so the retained prefix is independent of
      // camera LOD and remains bounded for a 1,200-bead worm.
      let lo = 0, hi = worm.tailLength.current;
      while (lo < hi) {
        const mid = Math.floor((lo + hi) / 2);
        if (bodyDistanceAt(worm, mid) <= safeDistance + EPS) lo = mid + 1;
        else hi = mid;
      }
      const keepCount = Math.max(1, lo);
      const protectedHead = (worm.landingGraceT?.current ?? 0) > 0;
      return {
        type: (headOnLayer && !protectedHead) || keepCount < BASE_TAIL_LENGTH ? 'death' : 'cut',
        cutDistance, keepCount, historyIndex: i, historyT: t,
        cutPosition: [a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t, a.z + (b.z - a.z) * t],
        headOnLayer,
      };
    }
    distance += length;
    a = b;
    previous = record;
  }
  return null;
}

/** Clip the last interpolation bracket to the seam, retaining head-side tags.
 * Keeping an uncut far bracket would let the moving layer drag surviving beads
 * across the gap. Trimming it outright would pile them onto one history point.
 */
export function clipSliceHistory(worm, hit) {
  const history = worm.stepHistory.current;
  const end = shAt(history, hit.historyIndex);
  const previous = hit.historyIndex > 0 ? shAt(history, hit.historyIndex - 1) : null;
  const normal = previous?.normal ?? worm.currentNormal.current;
  end.normal.lerpVectors(normal, end.normal, hit.historyT).normalize();
  end.pos.fromArray(hit.cutPosition);
  if (previous) {
    for (const key of ['tx', 'ty', 'tz', 'restTxn', 'restTx', 'restTy', 'restTz', 'transit']) end[key] = previous[key];
  } else {
    const tile = (worm.interpT.current < 0.5 && worm.prevTile.current) || worm.pos.current;
    end.tx = tile.x; end.ty = tile.y; end.tz = tile.z;
    end.restTxn = 0; end.transit = false;
  }
  history.count = hit.historyIndex + 1;
}
