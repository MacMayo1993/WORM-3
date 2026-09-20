import { Vector3 } from 'three';
import { makeBridgeCurve, fitBridgeToLength, sampleBridgeInto, bridgeHitsBoxes } from './bridgeCurve.js';
import { bodyLength, HOLD_LENGTH, LENGTH_MARGIN, missingOrdinaryOrbs, bridgeMaterialLedger } from './bodyMaterial.js';
const UP = new Vector3(0, 1, 0), FORWARD = new Vector3(1, 0, 0);
const STEP = 1 / 120;
const ease = t => { const x = Math.max(0, Math.min(1, t)); return x * x * (3 - 2 * x); };
const activeStates = new Set(['plant', 'reach', 'latch', 'pull', 'retract']);
const box = (min, max) => ({ min: new Vector3(...min), max: new Vector3(...max) });

/** Isolated two-island fixture. Normal WORM never activates this state machine. */
export function makeGapTraversal({ gap = .65, segments = 19, landingHeight = 0, obstacle = false, epoch = 0 } = {}) {
  if (![gap, segments, landingHeight].every(Number.isFinite) || gap < .1 || gap > 3 || segments < 4 || segments > 1200 || !Number.isInteger(segments) || Math.abs(landingHeight) > .5) throw new Error('Invalid gap fixture');
  const length = bodyLength(segments);
  const a = new Vector3(-gap / 2 - .12, .64, 0), b = new Vector3(gap / 2 + .12, .64 + landingHeight, 0);
  const runway = Math.max(1.2, length + .6);
  const supports = [box([-gap / 2 - runway, -.5, -.55], [-gap / 2, .5, .55]),
    box([gap / 2, -.5 + landingHeight, -.55], [gap / 2 + runway, .5 + landingHeight, .55])];
  const obstacles = obstacle ? [box([-.10, -.6, -.3], [.10, .80, .3])] : [];
  const shoulder = .12 + Math.min(.11, gap * .25);
  const straight = makeBridgeCurve(a, b, UP, 0, shoulder);
  const required = straight.lengthUpper + 2 * HOLD_LENGTH + LENGTH_MARGIN;
  let bridge = fitBridgeToLength(a, b, UP, length - 2 * HOLD_LENGTH - LENGTH_MARGIN, gap * .15, shoulder);
  let reason = bridge ? 'READY' : 'LENGTH';
  if (bridge && bridgeHitsBoxes(bridge, supports, .10)) bridge = makeBridgeCurve(a, b, UP, 0, shoulder);
  if (bridge && bridgeHitsBoxes(bridge, [...supports, ...obstacles], .10)) reason = 'OBSTRUCTED';
  // Before contact, only the occupied prefix is extended from the departure.
  // Following the validated approach avoids cutting through raised island edges.
  const approach = makeBridgeCurve(a, b, UP, (bridge?.sag ?? 0) * .25, shoulder);
  if (reason === 'READY' && bridgeHitsBoxes(approach, [...supports, ...obstacles], .10)) reason = 'OBSTRUCTED';
  const state = { a, b, supports, obstacles, gap, length, segments, shoulder, epoch, committedEpoch: epoch,
    bridge: bridge ?? straight, approach, curve: null, phase: 'idle', phaseTime: 0, progress: 0, pull: 0,
    headDistance: 0, held: false, paused: false, accumulator: 0, time: 0, droppedTime: 0, capEvents: 0,
    reason, required, missingOrbs: missingOrdinaryOrbs(required, segments), events: [],
    sourceAttached: true, targetAttached: false, spanOccupied: false, reservations: new Set(),
    stats: { catches: 0, completions: 0, cancellations: 0, recoveries: 0 }, ledger: null };
  publishLedger(state);
  return state;
}
function event(s, type, detail = {}) { s.events.push({ type, time: s.time, ...detail }); if (s.events.length > 32) s.events.shift(); }
function publishLedger(s) {
  const bridgeLength = s.curve?.length ?? 0;
  s.ledger = bridgeMaterialLedger(s.length, s.headDistance, bridgeLength);
  s.sourceAttached = s.ledger.departure > 1e-8 || s.phase === 'idle';
  s.spanOccupied = s.ledger.free > 1e-8;
  if (!s.sourceAttached && s.reservations.delete('departure')) event(s, 'tail-release');
  if (!s.spanOccupied && s.phase === 'complete') s.reservations.clear();
}
export const gapBusy = s => activeStates.has(s.phase);
export function setReachHeld(s, held) {
  s.held = held;
  if (held && s.phase === 'idle' && !s.paused && s.reason === 'READY') {
    s.committedEpoch = s.epoch; s.reservations.add('departure'); s.reservations.add('landing');
    s.phase = 'plant'; s.phaseTime = 0; event(s, 'plant');
  }
}
function returnToSupport(s, type) {
  s.phase = 'idle'; s.phaseTime = 0; s.progress = 0; s.pull = 0; s.headDistance = 0;
  s.curve = null; s.held = false; s.targetAttached = false; s.reservations.clear();
  s.stats[type === 'recover' ? 'recoveries' : 'cancellations']++;
  event(s, type); publishLedger(s);
}
function reachCurve(s) {
  s.curve = s.approach;
  s.headDistance = s.progress * s.approach.length;
}
function tick(s) {
  s.time += STEP;
  if (gapBusy(s) && s.epoch !== s.committedEpoch) { returnToSupport(s, 'recover'); return; }
  s.phaseTime += STEP;
  switch (s.phase) {
    case 'plant':
      if (!s.held) returnToSupport(s, 'cancel');
      else if (s.phaseTime >= .12) { s.phase = 'reach'; s.phaseTime = 0; event(s, 'reach'); }
      break;
    case 'reach':
      if (!s.held) { s.phase = 'retract'; s.phaseTime = 0; break; }
      s.progress = ease(s.phaseTime / (.32 + s.gap * .3)); reachCurve(s);
      if (s.progress >= 1) {
        s.phase = 'latch'; s.phaseTime = 0; s.targetAttached = true;
        s.stats.catches++; event(s, 'catch');
      }
      break;
    case 'latch': {
      const sag = s.bridge.sag * (.25 + .75 * ease(s.phaseTime / .18));
      s.curve = makeBridgeCurve(s.a, s.b, UP, sag, s.shoulder); s.headDistance = s.curve.length;
      if (s.phaseTime >= .18) { s.phase = 'pull'; s.phaseTime = 0; event(s, 'pull'); }
      break;
    }
    case 'pull':
      // Advance material at a world-space speed, regardless of worm length.
      s.pull += STEP * 1.5;
      s.curve = s.bridge; s.headDistance = s.curve.length + s.pull;
      if (s.pull >= s.length + HOLD_LENGTH) {
        s.phase = 'complete'; s.stats.completions++; event(s, 'complete');
      }
      break;
    case 'retract':
      s.progress = Math.max(0, s.progress - STEP / .35); reachCurve(s);
      if (s.progress === 0) returnToSupport(s, 'cancel');
      break;
  }
  publishLedger(s);
  if (Math.abs(s.ledger.total - s.length) > .001 || !Number.isFinite(s.headDistance)) returnToSupport(s, 'recover');
}
export function advanceGap(s, delta) {
  if (s.paused || !Number.isFinite(delta) || delta <= 0) return;
  // Discard tab-resume debt. Never replay a background interval as a failed reach.
  if (delta > .1) {
    const dropped = delta - .1;
    s.droppedTime += dropped; s.capEvents++;
    event(s, 'time-cap', { received: delta, accepted: .1, dropped });
  }
  s.accumulator += Math.min(delta, .1);
  while (s.accumulator + 1e-10 >= STEP) { s.accumulator -= STEP; tick(s); }
}
export function sampleGapBodyInto(s, distanceBehindHead, position, normal, forward) {
  const distance = Math.max(0, Math.min(s.length, distanceBehindHead));
  const along = s.headDistance - distance, curve = s.curve;
  if (!curve || along <= 0) {
    position.copy(s.a).addScaledVector(FORWARD, along); normal.copy(UP); forward.copy(FORWARD);
  } else if (along >= curve.length) {
    position.copy(curve.points.at(-1)).addScaledVector(FORWARD, along - curve.length); normal.copy(UP); forward.copy(FORWARD);
  } else sampleBridgeInto(curve, along, position, normal, forward);
  return position;
}
