import { Color, Vector3 } from 'three';
import { CORE_MIRROR_HALF } from './corePassage.js';
import { tunnelDockForCellInto } from '../utils/tunnelPath.js';

// One deliberate event per crossing. The simulation's t, not a wall clock,
// drives the leaders and the exchange, so pausing never leaves a flickering room.
const clamp = value => Math.max(0, Math.min(1, value));
const smooth = (a, b, value) => { const t = clamp((value - a) / (b - a)); return t * t * (3 - 2 * t); };

export function makeCoreMirrorCharge() {
  return {
    tunnel: null, palette: null, size: 0, calm: false,
    uniforms: {
      uChargeEntry: { value: new Vector3(0, 0, 1) },
      uChargeExit: { value: new Vector3(0, 0, -1) },
      uChargeColorA: { value: new Color('#33bbff') },
      uChargeColorB: { value: new Color('#ff8844') },
      uChargeLevel: { value: 0 },
      uChargeProgress: { value: 0 },
      uChargeExchange: { value: 0 },
      uChargeDischarge: { value: 0 },
      uChargeCalm: { value: 0 },
      uChargeCapture: { value: 0 },
    }
  };
}

/** Mutates reusable uniforms; no geometry, timers, random events or extra passes. */
export function updateCoreMirrorCharge(charge, tunnel, size, palette, t, {
  active = true, paused = false, reducedMotion = false, reduceFlashing = false, passageEnds = null
} = {}) {
  const u = charge.uniforms;
  const calm = !!(reducedMotion || reduceFlashing);
  const changed = charge.tunnel !== tunnel || charge.size !== size || charge.palette !== palette;
  if (changed && tunnel?.entry && tunnel?.exit) {
    const a = tunnel.entry, b = tunnel.exit;
    // Project the docks onto the mirror cube, keeping off-centre/corner routes
    // attached to their own tiles as the room grows.
    tunnelDockForCellInto(u.uChargeEntry.value, a.x, a.y, a.z, a.dirKey, size);
    tunnelDockForCellInto(u.uChargeExit.value, b.x, b.y, b.z, b.dirKey, size);
    for (const point of [u.uChargeEntry.value, u.uChargeExit.value]) {
      point.divideScalar(Math.max(Math.abs(point.x), Math.abs(point.y), Math.abs(point.z), .0001));
    }
    u.uChargeColorA.value.set(palette?.[tunnel.entryColor] || '#33bbff');
    u.uChargeColorB.value.set(palette?.[tunnel.exitColor] || '#ff8844');
  }
  charge.tunnel = tunnel; charge.size = size; charge.palette = palette;
  // A reset or a new route always replaces the old event, even while paused.
  if (!tunnel?.entry || !tunnel?.exit) {
    u.uChargeLevel.value = 0;
    u.uChargeDischarge.value = 0;
    return;
  }
  if (passageEnds?.active) {
    // The visual room zooms around the entrance but the ridden path stays put.
    // Follow its actual wall intersections, not the old unzoomed tile docks.
    u.uChargeEntry.value.copy(passageEnds.entry).divideScalar(CORE_MIRROR_HALF);
    u.uChargeExit.value.copy(passageEnds.exit).divideScalar(CORE_MIRROR_HALF);
  }
  if (paused && !changed && charge.calm === calm) return;
  charge.calm = calm;
  u.uChargeCalm.value = calm ? 1 : 0;
  const safeT = Number.isFinite(t) ? clamp(t) : 0;
  const progress = clamp((safeT - .4) / .2);
  u.uChargeProgress.value = calm ? .5 : progress;
  u.uChargeExchange.value = calm ? 0 : smooth(.42, .67, progress);
  // A broad, single crest, restricted to the seams. Never a full-screen flash.
  u.uChargeDischarge.value = !calm && active
    ? smooth(.30, .50, progress) * (1 - smooth(.50, .74, progress)) : 0;
  u.uChargeLevel.value = calm ? .34 : active
    ? .18 + .82 * smooth(.30, .40, safeT) * (1 - smooth(.61, .76, safeT)) : .18;
}

// Integrated into the mirror's existing fragment shader. No moving noise: a
// deterministic zigzag stays put while two small charge fronts travel over it.
// The open centre remains completely empty and mirrors retain their reflection.
export const coreMirrorChargeGLSL = `
uniform vec3 uChargeEntry, uChargeExit, uChargeColorA, uChargeColorB;
uniform float uChargeLevel, uChargeProgress, uChargeExchange, uChargeDischarge;
uniform float uChargeCalm, uChargeCapture;
varying vec3 vMirrorLocal;

float chargeWireCoverage(float offset, float px) {
  // Bound a wire in both screen pixels and tile space. A subpixel tile must
  // not become a solid white emitter merely to keep its wire a pixel wide.
  float width = min(px * .7, .012);
  return clamp((min(offset + px * .5, width) - max(offset - px * .5, -width)) / px, 0.0, 1.0);
}

vec3 mirrorCharge(vec2 uv, vec3 roomPoint) {
  if (uChargeLevel <= 0.0) return vec3(0.0);
  vec2 rim = min(uv, 1.0 - uv);
  bool vertical = rim.x < rim.y;
  float edge = vertical ? rim.x : rim.y;
  float along = vertical ? uv.y : uv.x;
  float px = max(fwidth(edge), .0005);
  // Most fragments are plain glass. Compute derivatives before this branch,
  // then skip the charge maths outside the narrow bevel/branch region.
  if (edge > .12) return vec3(0.0);
  // A continuous triangular kink makes a crisp leader without high-frequency
  // random strikes. It lives just inside the polished mirror bevel.
  float jag = abs(fract(along * 9.0) * 2.0 - 1.0);
  float wireAt = .018 + .015 * jag;
  float wire = chargeWireCoverage(edge - wireAt, px);
  float halo = 1.0 - smoothstep(.025, .095, edge);
  // Distance from each dock spreads along every wall, including corner routes.
  float a = length(roomPoint - uChargeEntry), b = length(roomPoint - uChargeExit);
  float route = a / max(a + b, .001);
  float polarity = smoothstep(.28, .72, route);
  vec3 tint = mix(uChargeColorA, uChargeColorB, mix(polarity, 1.0 - polarity, uChargeExchange));
  float progress = uChargeProgress;
  float inbound = min(.5, progress * 1.28 + .075);
  float outgoing = .5 + .5 * smoothstep(.50, 1.0, progress);
  float first = 1.0 - smoothstep(.035, .15, abs(route - mix(inbound, outgoing, step(.50, progress))));
  float opposite = (1.0 - smoothstep(.035, .15, abs(route - (1.0 - inbound)))) * (1.0 - smoothstep(.44, .58, progress));
  float leader = max(first, opposite) * (1.0 - uChargeCalm);
  // Thin short branches peel away only at the central exchange. Restrained
  // spatial coverage and the broad envelope avoid strobe/full-field pulses.
  float branchGate = (1.0 - smoothstep(.0, .18, abs(along - .5))) * uChargeDischarge;
  float branchAt = wireAt + .07 * (1.0 - abs(along - .5) / .18);
  float branch = chargeWireCoverage(edge - branchAt, px) * branchGate;
  float middle = 1.0 - smoothstep(.08, .32, abs(route - .5));
  float discharge = uChargeDischarge * middle;
  // After the exchange, the exit colour takes the outward-moving front.
  tint = mix(tint, uChargeColorB, uChargeExchange * leader);
  vec3 hot = mix(tint, vec3(.86, .94, 1.0), .64);
  vec3 emission = tint * halo * (.075 + .14 * leader + .10 * discharge)
    + hot * (wire * (.075 + .65 * leader + .38 * discharge) + branch * .25);
  // Echoes are softer than direct arcs, also preventing the infinity mirrors
  // from feeding the discharge back into a wall-filling white bloom.
  return emission * uChargeLevel * mix(1.0, .28, uChargeCapture);
}
`;
