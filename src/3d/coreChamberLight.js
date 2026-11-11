import { Color, Vector3 } from 'three';
import { CORE_MIRROR_HALF } from './corePassage.js';
import { tunnelDockForCellInto } from '../utils/tunnelPath.js';

// One continuous reveal per crossing, driven by the lens's simulation progress.
// No wall clock or random events: pause and accessibility modes hold the field.
const clamp = value => Math.max(0, Math.min(1, value));
const smooth = (a, b, value) => { const t = clamp((value - a) / (b - a)); return t * t * (3 - 2 * t); };

export function makeCoreChamberLight() {
  return {
    tunnel: null, palette: null, size: 0, calm: false,
    uniforms: {
      uChamberEntry: { value: new Vector3(0, 0, 1) },
      uChamberExit: { value: new Vector3(0, 0, -1) },
      uChamberColorA: { value: new Color('#33bbff') },
      uChamberColorB: { value: new Color('#ff8844') },
      uChamberLevel: { value: 0 },
      uChamberProgress: { value: 0 },
      uChamberReveal: { value: 0 },
      uChamberCrest: { value: 0 },
      uChamberCalm: { value: 0 },
      uChamberCapture: { value: 0 },
    }
  };
}

/** Mutates reusable uniforms; no geometry, timers, random events or extra passes. */
export function updateCoreChamberLight(lighting, tunnel, size, palette, t, {
  active = true, paused = false, reducedMotion = false, reduceFlashing = false, passageEnds = null
} = {}) {
  const u = lighting.uniforms;
  const calm = !!(reducedMotion || reduceFlashing);
  const changed = lighting.tunnel !== tunnel || lighting.size !== size || lighting.palette !== palette;
  if (changed && tunnel?.entry && tunnel?.exit) {
    const a = tunnel.entry, b = tunnel.exit;
    // Project the docks onto the mirror cube, keeping off-centre/corner routes
    // attached to their own tiles as the room grows.
    tunnelDockForCellInto(u.uChamberEntry.value, a.x, a.y, a.z, a.dirKey, size);
    tunnelDockForCellInto(u.uChamberExit.value, b.x, b.y, b.z, b.dirKey, size);
    for (const point of [u.uChamberEntry.value, u.uChamberExit.value]) {
      point.divideScalar(Math.max(Math.abs(point.x), Math.abs(point.y), Math.abs(point.z), .0001));
    }
    u.uChamberColorA.value.set(palette?.[tunnel.entryColor] || '#33bbff');
    u.uChamberColorB.value.set(palette?.[tunnel.exitColor] || '#ff8844');
  }
  lighting.tunnel = tunnel; lighting.size = size; lighting.palette = palette;
  // A reset or a new route always replaces the old event, even while paused.
  if (!tunnel?.entry || !tunnel?.exit) {
    u.uChamberLevel.value = 0;
    u.uChamberCrest.value = 0;
    return;
  }
  if (passageEnds?.active) {
    // The visual room zooms around the entrance but the ridden path stays put.
    // Follow its actual wall intersections, not the old unzoomed tile docks.
    u.uChamberEntry.value.copy(passageEnds.entry).divideScalar(CORE_MIRROR_HALF);
    u.uChamberExit.value.copy(passageEnds.exit).divideScalar(CORE_MIRROR_HALF);
  }
  if (paused && !changed && lighting.calm === calm) return;
  lighting.calm = calm;
  u.uChamberCalm.value = calm ? 1 : 0;
  const safeT = Number.isFinite(t) ? clamp(t) : 0;
  const progress = clamp((safeT - .4) / .2);
  u.uChamberProgress.value = calm ? .5 : progress;
  u.uChamberReveal.value = calm ? 0 : smooth(.42, .67, progress);
  // A gentle pearl crest where the two colours meet; no exposure flash.
  u.uChamberCrest.value = !calm && active
    ? smooth(.30, .50, progress) * (1 - smooth(.50, .74, progress)) : 0;
  u.uChamberLevel.value = calm ? .34 : active
    ? .18 + .82 * smooth(.30, .40, safeT) * (1 - smooth(.61, .76, safeT)) : .18;
}

// Smooth room-space ribbons span entire walls, independent of the tile count.
// Broad caustics, pearl architectural frames and dock halos repeat in the live
// mirrors; the central flight path stays empty. All motion uses held progress.
export const coreChamberLightGLSL = `
uniform vec3 uChamberEntry, uChamberExit, uChamberColorA, uChamberColorB;
uniform float uChamberLevel, uChamberProgress, uChamberReveal, uChamberCrest;
uniform float uChamberCalm, uChamberCapture;
varying vec3 vMirrorLocal;

vec3 chamberLight(vec3 p) {
  if (uChamberLevel <= 0.0) return vec3(0.0);
  float a = length(p - uChamberEntry), b = length(p - uChamberExit);
  float route = a / max(a + b, .001);
  float progress = uChamberProgress;
  // The entrance colour gradually hands the whole chamber to the destination.
  float blend = smoothstep(.12, .88, route * .55 + uChamberReveal * .45);
  vec3 tint = mix(uChamberColorA, uChamberColorB, blend);
  vec3 pearl = mix(tint, vec3(.82, .93, 1.0), .72);

  // Two slow, continuous caustic ribbons. Their scale is the room, so a 15x15
  // board has the same sweeping architecture as a 3x3, not 25x more sparks.
  float wave = sin(p.y * 2.4 + p.x * 1.1 + sin(p.z * 1.8) - progress * 2.4);
  float front = (route - mix(.12, .88, progress)) * 2.2 + .18 * wave;
  float ribbon = 1.0 - smoothstep(.06, .30, abs(front));
  float silk = sin(dot(p, vec3(1.9, 1.2, 2.4)) - progress * 2.0);
  float caustic = 1.0 - smoothstep(.08, .38, abs(silk));
  float glint = 1.0 - smoothstep(.015, .075, abs(front));

  // Median absolute coordinate is the distance to a square frame on any wall.
  // Two nested frames give the recursive mirrors a legible sense of depth.
  vec3 q = abs(p);
  float frameAt = max(min(q.x, q.y), min(max(q.x, q.y), q.z));
  float px = max(fwidth(frameAt), .002);
  float frame = 1.0 - smoothstep(px, px + .014, abs(frameAt - .84));
  float echo = 1.0 - smoothstep(px, px + .009, abs(frameAt - .67));
  float dock = exp(-a * a * 2.8) * (1.0 - .65 * uChamberReveal)
    + exp(-b * b * 2.8) * (.35 + .65 * uChamberReveal);
  vec3 prism = .55 + .45 * cos(vec3(0.0, 2.1, 4.2) + dot(p, vec3(.9, 1.2, .7)) + progress * 1.8);
  vec3 light = tint * (.035 + .28 * ribbon + .13 * caustic + .16 * dock)
    + pearl * (.09 * glint + .13 * frame + .045 * echo) * (.8 + .2 * uChamberCrest)
    + prism * caustic * .065;
  // Recursive reflections receive a softer copy, avoiding white feedback.
  return light * uChamberLevel * mix(1.0, .28, uChamberCapture);
}
`;
