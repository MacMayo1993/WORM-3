import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Vector3, Group } from 'three';
import {
  createDiveLeap, planDiveLeap, sampleDiveLeap, diveLeapTravel, portalOpenAt,
  DIVE_LEAP_START, DIVE_LEAP_TIME, DIVE_ZOOM_START, DIVE_TOTAL, DIVE_PORTAL_LIFT,
} from '../components/menus/menuDiveLeap.js';
import {
  createWormReaction, pokeWorm, wagWorm, aimWormHead, wormReactionFaceInto, wormReactionSegmentInto, POKE_SECONDS, HEAD_YAW_MAX,
} from '../components/menus/menuWormReaction.js';
import { carouselWormMood, carouselMoodRoll, carouselMoodBeat, carouselMoodPace, CAROUSEL_MOOD_FACES } from '../components/menus/carouselWormMood.js';
import { registerPokeTarget, findPokeTarget, wormTookTap, menuLeanInto, retainMenuPointer, resetMenuPointer, menuPointer } from '../components/menus/menuPointer.js';
import { lightSweepAt, SWEEP_PERIOD, SWEEP_TIME } from '../components/menus/menuLightSweep.js';
import { animateWormFace } from '../worm/wormFaceExpression.js';
import { createMenuCharacterRig } from '../components/menus/menuCharacterRig.js';
import { CUBE_WORM_HALF, CUBE_WORM_CLEARANCE } from '../components/menus/cubeWormPath.js';

const motion = () => ({ width: 1, stretch: 1, lift: 0, sway: 0, roll: 0 });

describe('the dive leap', () => {
  const head = { position: new Vector3(-1.2, -0.6, 1.58 + 0.16), normal: new Vector3(0, 0, 1), forward: new Vector3(1, 0, 0) };

  it('leaves from the head and ends falling into the portal on the chosen face', () => {
    const leap = planDiveLeap(createDiveLeap(), head, 'PX');
    expect(leap.points[0].distanceTo(head.position)).toBeLessThan(1e-6);
    const p = new Vector3(), n = new Vector3(), f = new Vector3();
    // At the mouth the worm is in the portal's plane, at its centre, heading in.
    const depth = sampleDiveLeap(leap, leap.mouth, p, n, f);
    expect(depth).toBeCloseTo(0, 2);
    expect(p.distanceTo(new Vector3(DIVE_PORTAL_LIFT, 0, 0))).toBeLessThan(0.05);
    expect(f.x).toBeLessThan(-0.9);
    // It ends below the face, inside the cube.
    expect(sampleDiveLeap(leap, leap.length, p, n, f)).toBeGreaterThan(0.5);
  });

  it('arcs clear of the cube until it is over the hole', () => {
    const leap = planDiveLeap(createDiveLeap(), head, 'PY');
    const p = new Vector3(), n = new Vector3(), f = new Vector3(), q = new Vector3();
    const clamp = v => Math.max(-CUBE_WORM_HALF, Math.min(CUBE_WORM_HALF, v));
    for (let s = 0.05; s < leap.mouth; s += 0.05) {
      sampleDiveLeap(leap, s, p, n, f);
      const lateral = Math.hypot(p.x, p.z);
      if (lateral < 0.6) continue; // over the portal
      q.set(clamp(p.x), clamp(p.y), clamp(p.z));
      expect(p.distanceTo(q)).toBeGreaterThan(CUBE_WORM_CLEARANCE * 0.8);
      // A worm frame that never flips: up stays perpendicular to travel.
      expect(Math.abs(n.dot(f))).toBeLessThan(1e-6);
      expect(n.length()).toBeCloseTo(1, 6);
    }
  });

  it('plans the twin into the antipodal face', () => {
    const leap = planDiveLeap(createDiveLeap(), head, 'PZ', true);
    expect(leap.center.z).toBeCloseTo(-DIVE_PORTAL_LIFT, 9);
  });

  it('times the head into the portal as the zoom starts', () => {
    const leap = planDiveLeap(createDiveLeap(), head, 'PZ');
    expect(diveLeapTravel(leap, 0)).toBe(0);
    expect(diveLeapTravel(leap, DIVE_LEAP_START)).toBe(0);
    expect(diveLeapTravel(leap, DIVE_LEAP_START + DIVE_LEAP_TIME)).toBeCloseTo(leap.mouth, 9);
    expect(DIVE_ZOOM_START).toBeCloseTo(DIVE_LEAP_START + DIVE_LEAP_TIME, 9);
    // The rest of the body is in by the end of the dive.
    expect(diveLeapTravel(leap, DIVE_TOTAL)).toBeGreaterThan(leap.mouth + 11 * 0.13);
    let last = -1;
    for (let t = 0; t <= DIVE_TOTAL; t += 0.02) { const s = diveLeapTravel(leap, t); expect(s).toBeGreaterThanOrEqual(last); last = s; }
  });

  it('pops the portal open with a little overshoot', () => {
    expect(portalOpenAt(0)).toBeCloseTo(0, 9);
    expect(portalOpenAt(10)).toBe(1);
    const peak = Math.max(...Array.from({ length: 40 }, (_, i) => portalOpenAt(i * 0.01)));
    expect(peak).toBeGreaterThan(1);
    expect(peak).toBeLessThan(1.25);
  });
});

describe('a worm answering the player', () => {
  it('turns its head part way toward what it looks at and lets the eyes do the rest', () => {
    const r = createWormReaction();
    const right = new Vector3(1, 0, -0.2).normalize();
    for (let t = 0; t <= 2; t += 1 / 60) aimWormHead(r, right, t);
    expect(r.yaw).toBeLessThan(0); // +X is a negative yaw from -Z
    expect(Math.abs(r.yaw)).toBeCloseTo(HEAD_YAW_MAX, 2);
    expect(r.gazeX).toBeLessThan(-0.5);
    // Looking away: head and eyes go back.
    for (let t = 2; t <= 4; t += 1 / 60) aimWormHead(r, null, t);
    expect(Math.abs(r.yaw)).toBeLessThan(0.01);
    expect(r.weight).toBeLessThan(0.01);
  });

  it('keeps the head still under reduced motion but still looks', () => {
    const r = createWormReaction();
    for (let t = 0; t <= 1; t += 1 / 60) aimWormHead(r, new Vector3(0.6, 0, -0.8), t, true);
    expect(r.yaw).toBe(0);
    expect(r.gazeX).toBeLessThan(0);
  });

  it('gasps, hops head first and grins when poked', () => {
    const r = createWormReaction();
    pokeWorm(r, 10);
    const face = {};
    expect(wormReactionFaceInto(face, r, 10.1).surprise).toBe(1);
    expect(wormReactionFaceInto(face, r, 10.7).delight).toBeGreaterThan(0.9);
    expect(wormReactionFaceInto(face, r, 10 + POKE_SECONDS + 0.1)).toMatchObject({ surprise: 0, delight: 0 });
    const head = wormReactionSegmentInto(motion(), r, 0, 10, 10.3, 0.15);
    const tail = wormReactionSegmentInto(motion(), r, 9, 10, 10.3, 0.15);
    expect(head.lift).toBeGreaterThan(0.1);
    expect(head.lift).toBeGreaterThan(tail.lift);
    // Reduced motion: the face still answers, the body stays put.
    expect(wormReactionSegmentInto(motion(), r, 0, 10, 10.3, 0.15, true)).toEqual(motion());
  });

  it('wags only its tail', () => {
    const r = createWormReaction();
    wagWorm(r, 5);
    expect(wormReactionSegmentInto(motion(), r, 1, 12, 5.3, 0.15).sway).toBe(0);
    let moved = 0;
    for (let t = 5; t < 6; t += 0.05) moved = Math.max(moved, Math.abs(wormReactionSegmentInto(motion(), r, 11, 12, t, 0.15).sway));
    expect(moved).toBeGreaterThan(0.03);
  });
});

describe('the face', () => {
  const parts = () => ({
    eyes: [new Group(), new Group()], pupils: [new Group(), new Group()], mouth: new Group(),
  });
  const reset = face => { face.eyes.forEach(e => e.scale.set(1, 1, 1)); face.pupils.forEach(p => { p.scale.set(1, 1, 1); p.position.set(0, 0, 0); }); face.mouth.scale.set(1, 1, 1); };

  it('aims both pupils where it is told to look', () => {
    const face = parts();
    reset(face);
    animateWormFace(face, 'classic', 1, { look: { x: 1, y: 0 } });
    const left = face.pupils[0].position.x;
    reset(face);
    animateWormFace(face, 'classic', 1, { look: { x: -1, y: 0 } });
    expect(face.pupils[0].position.x).toBeLessThan(left);
  });

  it('widens the eyes and rounds the mouth in surprise, and nothing changes without it', () => {
    const face = parts();
    reset(face);
    animateWormFace(face, 'classic', 3.4);
    const calm = { eye: face.eyes[0].scale.y, mouth: face.mouth.scale.y };
    reset(face);
    animateWormFace(face, 'classic', 3.4, { surprise: 1 });
    expect(face.eyes[0].scale.y).toBeGreaterThan(calm.eye);
    expect(face.mouth.scale.y).toBeGreaterThan(calm.mouth * 1.5);
  });
});

describe('carousel moods', () => {
  it('gives every mode face its own mood', () => {
    const moods = CAROUSEL_MOOD_FACES.map(carouselWormMood);
    expect(moods.map(m => JSON.stringify(m)).length).toBe(new Set(moods.map(m => JSON.stringify(m))).size);
    expect(carouselWormMood('PX').hat).toBe('grad');
    expect(carouselWormMood('NZ').speed).toBeGreaterThan(1);
  });

  it('rolls the Flip Cube worm a whole turn, head first', () => {
    const mood = carouselWormMood('NY');
    expect(carouselMoodRoll(mood, 0, 0.5)).toBeGreaterThan(carouselMoodRoll(mood, 6, 0.5));
    expect(carouselMoodRoll(mood, 0, 2)).toBe(0);
    expect(carouselMoodRoll(carouselWormMood('NX'), 0, 0.5)).toBe(0);
  });

  it('fires each accent once per beat and never on the first frame', () => {
    const mood = carouselWormMood('NZ');
    let state = carouselMoodBeat(mood, 0.1, null);
    expect(state.fire).toBe(false);
    let fired = 0;
    for (let t = 0.1; t < 5; t += 1 / 60) { state = carouselMoodBeat(mood, t, state.beat); if (state.fire) fired++; }
    expect(fired).toBe(3);
  });

  it('keeps every pace positive', () => {
    for (const face of CAROUSEL_MOOD_FACES) for (let t = 0; t < 20; t += 0.37) expect(carouselMoodPace(carouselWormMood(face), t)).toBeGreaterThan(0.5);
  });
});

describe('the menu pointer', () => {
  afterEach(() => resetMenuPointer());

  it('pokes the nearest worm within reach of a press, and the cube click learns it', () => {
    const near = registerPokeTarget(vi.fn()), far = registerPokeTarget(vi.fn());
    Object.assign(near, { visible: true, count: 1, reach: 40 }); near.points.set([100, 100]);
    Object.assign(far, { visible: true, count: 1, reach: 40 }); far.points.set([130, 100]);
    expect(findPokeTarget(105, 100)).toBe(near);
    expect(findPokeTarget(400, 400)).toBeNull();
    far.visible = false;
    expect(findPokeTarget(128, 100)).toBe(near);
    const release = retainMenuPointer();
    window.dispatchEvent(Object.assign(new Event('pointerdown'), { clientX: 102, clientY: 98, pointerType: 'mouse' }));
    expect(near.onPoke).toHaveBeenCalledOnce();
    expect(wormTookTap()).toBe(true);
    expect(wormTookTap()).toBe(false);
    window.dispatchEvent(Object.assign(new Event('pointerdown'), { clientX: 600, clientY: 600, pointerType: 'mouse' }));
    expect(wormTookTap()).toBe(false);
    release();
  });

  it('leans toward a recent mouse and rests when it is still', () => {
    const release = retainMenuPointer();
    vi.spyOn(performance, 'now').mockReturnValue(1000);
    window.dispatchEvent(Object.assign(new Event('pointermove'), { clientX: window.innerWidth, clientY: 0, pointerType: 'mouse' }));
    const lean = menuLeanInto({ x: 0, y: 0 }, 1500);
    expect(lean.x).toBeCloseTo(1, 6);
    expect(lean.y).toBeCloseTo(1, 6);
    expect(menuLeanInto({ x: 0, y: 0 }, 1000 + 60_000)).toEqual({ x: 0, y: 0 });
    // A finger never leans the scene by where it touched.
    window.dispatchEvent(Object.assign(new Event('pointermove'), { clientX: 0, clientY: 0, pointerType: 'touch' }));
    expect(menuPointer.touch).toBe(true);
    expect(menuLeanInto({ x: 0, y: 0 }, 1500)).toEqual({ x: 0, y: 0 });
    release();
    vi.restoreAllMocks();
  });
});

describe('the light sweep', () => {
  it('crosses the cube once a period and is dark between', () => {
    expect(lightSweepAt(0).strength).toBe(0);
    const mid = lightSweepAt(SWEEP_TIME / 2);
    expect(mid.strength).toBeCloseTo(1, 6);
    expect(mid.x).toBeCloseTo(0, 6);
    expect(lightSweepAt(SWEEP_TIME + 1).strength).toBe(0);
    expect(lightSweepAt(SWEEP_PERIOD + SWEEP_TIME / 2).strength).toBeCloseTo(1, 6);
  });
});

describe('the rig answering the player', () => {
  beforeEach(() => {
    vi.stubGlobal('matchMedia', () => ({ matches: false }));
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({ createRadialGradient: () => ({ addColorStop() {} }), fillRect() {} });
  });
  afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

  const poseAll = (rig, time) => {
    const n = new Vector3(0, 0, 1), f = new Vector3(0, 1, 0);
    for (let i = 0; i < rig.segments.length; i++) rig.pose(i, new Vector3(0, -i * 0.115, 1.63), n, f, true, time, null, false);
    rig.endFrame(time, false);
    rig.group.updateMatrixWorld(true);
  };

  it('turns its head to a point beside it', () => {
    const rig = createMenuCharacterRig('classic');
    const head = rig.segments[0].holder;
    for (let k = 0; k < 90; k++) { rig.react(k / 60, { lookAt: new Vector3(2, 0, 1.63) }); poseAll(rig, 1); }
    // Its forward (-Z) has swung toward +X.
    const forward = new Vector3(0, 0, -1).applyQuaternion(head.quaternion);
    expect(forward.x).toBeGreaterThan(0.3);
    rig.dispose();
  });

  it('hops when poked and throws sparks off its head', () => {
    const rig = createMenuCharacterRig('wiggle');
    rig.react(0); poseAll(rig, 1);
    const rest = rig.segments[0].holder.position.z;
    rig.poke(0, false);
    const sparks = Array.from(rig.finish.trail.geometry.attributes.aFade.array);
    rig.react(0.3); poseAll(rig, 1.05);
    expect(rig.segments[0].holder.position.z).toBeGreaterThan(rest + 0.05);
    const lit = Array.from(rig.finish.trail.geometry.attributes.aFade.array).filter(v => v > 0).length;
    expect(lit).toBeGreaterThan(sparks.filter(v => v > 0).length);
    rig.dispose();
  });

  it('wears a handmade hat on its head and takes it off again', () => {
    const rig = createMenuCharacterRig('classic');
    rig.setHat('sprout');
    expect(rig.segments[0].holder.getObjectByName('menu-worm-hat')).toBeDefined();
    rig.setHat('none');
    expect(rig.segments[0].holder.getObjectByName('menu-worm-hat')).toBeUndefined();
    rig.dispose();
  });

  it('never hangs a hat on MOBI', () => {
    const rig = createMenuCharacterRig('mobi');
    rig.setHat('sprout');
    expect(rig.segments[0].holder.getObjectByName('menu-worm-hat')).toBeUndefined();
    rig.dispose();
  });
});

