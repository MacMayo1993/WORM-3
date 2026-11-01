import React, { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { prefersReducedMotion } from '../../utils/device.js';
import { useGameStore } from '../../hooks/useGameStore.js';
import { feel } from '../../utils/feel.js';
import { isCarouselActive, getCarouselFace, getModeDiveState } from './menuCarouselState.js';
import { sampleWigglingCubeWorm, carouselWormMotion, CUBE_WORM_CLEARANCE, CAROUSEL_WORM_SEGMENTS, CAROUSEL_WORM_STEP, CAROUSEL_WORM_HEAD, CAROUSEL_WORM_BODY } from './cubeWormPath.js';
import { createMenuCharacterRig } from './menuCharacterRig.js';
import { createDiveLeap, planDiveLeap, sampleDiveLeap, diveLeapTravel, diveSegmentLookInto } from './menuDiveLeap.js';
import { carouselWormMood, carouselMoodPace, carouselMoodRoll, carouselMoodJitter, carouselMoodBeat } from './carouselWormMood.js';
import { registerPokeTarget, retainMenuPointer } from './menuPointer.js';
import { updatePokeTarget, pointerLookPoint } from './menuWormPoke.js';

const CAROUSEL_WORM_SPEED = 1.1;
const POKE_POINTS = [0, 3, 6, 9];

// The squeeze's own share of each bead's lag behind the head (see the crawl).
const segmentLag = (i, time) => i * CAROUSEL_WORM_STEP + 0.04 * (Math.sin(time * 6 - i * 0.7) - Math.sin(time * 6));

// Mounted INSIDE the cube's transform. No screen coordinates or independent
// world-space movement: carousel turns, wobble, scale and dive carry every part.
function CarouselCompanion({ shared, character, skinId, hatId, antipodal = false }) {
  const model = useMemo(() => {
    const rig = createMenuCharacterRig(character, {
      skinId,
      segments: CAROUSEL_WORM_SEGMENTS,
      headRadius: CAROUSEL_WORM_HEAD,
      bodyRadius: CAROUSEL_WORM_BODY,
      clearance: CUBE_WORM_CLEARANCE,
      // The carousel cube is shown big: a heavier line keeps the same weight.
      inkWidth: 0.024,
    });
    rig.group.renderOrder = 40;
    return rig;
  }, [character, skinId]);
  const local = useMemo(() => ({
    position: new THREE.Vector3(), normal: new THREE.Vector3(), forward: new THREE.Vector3(),
    look: new THREE.Vector3(), center: new THREE.Vector3(), portal: new THREE.Vector3(), motion: {},
    hat: undefined, glow: undefined, prop: undefined, beat: null, zapUntil: -Infinity, entered: false, now: 0,
    segment: { visible: true, throat: 0 },
  }), []);
  useEffect(() => () => model.dispose(), [model]);
  useEffect(() => { local.hat = undefined; local.glow = undefined; local.prop = undefined; }, [model, local]);
  useEffect(() => {
    const release = retainMenuPointer();
    const target = registerPokeTarget(() => {
      model.poke(local.now);
      feel('jump');
    });
    local.target = target;
    return () => { target.release(); release(); };
  }, [model, local]);
  useFrame(state => {
    const active = isCarouselActive();
    model.group.visible = active;
    if (local.target) local.target.visible = false;
    if (!active) return;
    const now = local.now = state.clock.elapsedTime;
    const reduced = prefersReducedMotion() || useGameStore.getState().settings?.reducedMotion;
    const dive = shared.dive.active ? shared.dive : null;
    // The body's shape freezes at the leap (`time`); its clock (`clock`:
    // trail, sparks, skin) keeps running so the dive's own effects play.
    const time = dive ? dive.time0 : shared.time;
    const clock = dive ? dive.time0 + dive.t : shared.time;
    const mood = shared.mood;

    // Dress for the face: the player's own hat, else the mode's; the mode's
    // trail colour and anything it carries (the Store's coin).
    const hat = hatId && hatId !== 'none' ? hatId : mood.hat;
    if (hat !== local.hat) { model.setHat(hat); local.hat = hat; }
    if (mood.glow !== local.glow) { model.setGlow(mood.glow); local.glow = mood.glow; }
    if (mood.prop !== local.prop) { model.setProp(mood.prop); local.prop = mood.prop; }

    // What it looks at: the portal it is about to dive into, else the pointer.
    model.group.getWorldPosition(local.center);
    let lookAt = null;
    if (dive) {
      local.portal.copy(dive.leap.center);
      if (antipodal) local.portal.negate();
      lookAt = model.group.localToWorld(local.portal);
    } else lookAt = pointerLookPoint(local.look, state.camera, local.center);
    // Mood accents: CHAOS crackles (a zap and a jolt), STORE glints.
    const beat = carouselMoodBeat(mood, time, local.beat);
    local.beat = beat.beat;
    if (beat.fire && !reduced && !dive) {
      if (mood.jitters) { model.sparkle({ count: 8, speed: 1.4, lift: 0.6 }); local.zapUntil = now + 0.22; }
      else model.sparkle({ count: 6, speed: 0.6, lift: 0.9 });
    }
    model.react(now, {
      lookAt,
      dizzy: dive ? 0 : mood.dizzy,
      surprise: Math.max(shared.startle, now < local.zapUntil ? 1 : 0),
      delight: dive ? 1 : mood.glints ? 0.5 : 0,
    });

    const travel = dive ? diveLeapTravel(dive.leap, dive.t) : 0;
    const blend = dive ? Math.min(1, dive.t / 0.12) : 0;
    for (let i = 0; i < CAROUSEL_WORM_SEGMENTS; i++) {
      const motion = carouselWormMotion(i, time, local.motion, reduced);
      let visible = true;
      if (!dive) {
        sampleWigglingCubeWorm(shared.distance - (reduced ? i * CAROUSEL_WORM_STEP : segmentLag(i, time)), i, time, local.position, local.normal, local.forward, antipodal);
        if (!reduced) {
          motion.roll += carouselMoodRoll(mood, i, time);
          motion.sway += carouselMoodJitter(mood, i, now, CAROUSEL_WORM_BODY);
          // Swiping the cube flings the body; it sways back and settles.
          motion.sway += CAROUSEL_WORM_BODY * shared.wobble * Math.sin(1.1 + i * 0.55) * (0.4 + i / CAROUSEL_WORM_SEGMENTS);
          motion.lift += CAROUSEL_WORM_BODY * 0.3 * Math.abs(shared.wobble) * Math.min(1, i / 3);
        }
      } else {
        const u = travel - segmentLag(i, time);
        if (u < 0) {
          // Still on the cube, hurrying after the head.
          sampleWigglingCubeWorm(dive.distance + u, i, time, local.position, local.normal, local.forward, antipodal);
          motion.stretch *= 1 + 0.1 * blend;
        } else {
          const depth = sampleDiveLeap(dive.leap, u, local.position, local.normal, local.forward);
          if (antipodal) { local.position.negate(); local.normal.negate(); local.forward.negate(); }
          // Stretched out in flight, squeezed thin through the portal, gone
          // once it is down the hole (never earlier: see diveSegmentLookInto).
          const look = diveSegmentLookInto(local.segment, dive.leap, u, depth);
          visible = look.visible;
          motion.stretch = 1.14 + 0.2 * look.throat;
          motion.width = 0.94 - 0.16 * look.throat;
          motion.lift = 0;
          motion.ground = 0;
        }
      }
      model.pose(i, local.position, local.normal, local.forward, visible, clock, motion, reduced);
    }
    if (dive && !local.entered && travel >= dive.leap.mouth) {
      local.entered = true;
      local.portal.copy(dive.leap.center);
      local.normal.copy(dive.leap.normal);
      if (antipodal) { local.portal.negate(); local.normal.negate(); }
      if (!reduced) model.burst(local.portal, local.normal, clock, { count: 14, speed: -1.1, lift: 0.1 });
    }
    if (!dive) local.entered = false;
    model.endFrame(clock, reduced);
    if (local.target && !dive) updatePokeTarget(local.target, model, state.camera, state.size, POKE_POINTS, 46);
  });
  return <primitive object={model.group} dispose={null} />;
}

const _q = new THREE.Quaternion(), _head = new THREE.Vector3(), _normal = new THREE.Vector3(), _forward = new THREE.Vector3(), _toCamera = new THREE.Vector3(), _center = new THREE.Vector3();

// The player's own worm, in its equipped skin (and hat), crawls the mode cube.
// One clock drives it and its twin at the antipode: each corresponding body
// segment is antipodal, even at rounded edges and while reduced motion holds
// the pair still. On PLAY the twin on the camera's side leaps into the portal
// that opens on the presented face (the other dives into its antipode's).
export default function CubeGlowWorm() {
  const root = useRef();
  const character = useGameStore(state => state.wormCharacter) || 'classic';
  const skinId = useGameStore(state => state.wormSkin) || 'slime';
  const hatId = useGameStore(state => state.wormHat) || 'none';
  const shared = useMemo(() => ({
    distance: 1.8, time: 1.8 / CAROUSEL_WORM_SPEED, mood: carouselWormMood('NX'),
    lastQ: new THREE.Quaternion(), hasQ: false, wobble: 0, wobbleV: 0, startle: 0,
    dive: { active: false, leap: createDiveLeap(), distance: 0, time0: 0, t: 0, sounded: false },
  }), []);
  // Runs before the companions (negative priority), so they read this frame's state.
  useFrame((state, delta) => {
    const active = isCarouselActive();
    const reduced = prefersReducedMotion() || useGameStore.getState().settings?.reducedMotion;
    const dt = Math.min(delta, 0.05);
    shared.mood = carouselWormMood(getCarouselFace() || 'NX');
    const request = active ? getModeDiveState() : null;
    const dive = shared.dive;
    if (!request || request.reduced) {
      dive.active = false;
      dive.sounded = false;
    } else if (!dive.active && root.current) {
      // Plan the leap from where the head is now, for whichever twin the
      // camera can see.
      sampleWigglingCubeWorm(shared.distance, 0, shared.time, _head, _normal, _forward);
      root.current.updateWorldMatrix(true, false);
      root.current.getWorldPosition(_center);
      const world = _head.clone().applyMatrix4(root.current.matrixWorld);
      _toCamera.subVectors(state.camera.position, world);
      const flip = world.sub(_center).dot(_toCamera) < 0;
      planDiveLeap(dive.leap, { position: _head, normal: _normal, forward: _forward }, request.face, flip);
      Object.assign(dive, { active: true, distance: shared.distance, time0: shared.time, sounded: false });
    }
    if (dive.active) {
      dive.t = request.t;
      if (!dive.sounded && diveLeapTravel(dive.leap, dive.t) >= dive.leap.mouth) {
        dive.sounded = true;
        feel('dive', { haptics: false });
      }
    }

    // Swiping the carousel turns the cube: its angular speed kicks a spring
    // the body sways on, and a hard flick makes the worm gasp.
    if (root.current && active && dt > 0) {
      root.current.getWorldQuaternion(_q);
      const spin = shared.hasQ ? _q.angleTo(shared.lastQ) / dt : 0;
      shared.lastQ.copy(_q);
      shared.hasQ = true;
      const force = Math.min(spin, 8) * 2.4;
      shared.wobbleV += (-70 * shared.wobble - 6 * shared.wobbleV + force) * dt;
      shared.wobble = Math.max(-1.6, Math.min(1.6, shared.wobble + shared.wobbleV * dt));
      shared.startle = Math.max(0, Math.min(1, (spin - 2.5) / 3)) || shared.startle * Math.exp(-dt * 4);
    } else shared.hasQ = false;

    if (active && !reduced && !document.hidden && !dive.active) {
      shared.distance += dt * CAROUSEL_WORM_SPEED * carouselMoodPace(shared.mood, shared.time);
      shared.time += dt * (shared.mood.jitters ? 1.35 : 1);
    }
  }, -0.05);
  return <group ref={root}>
    <CarouselCompanion shared={shared} character={character} skinId={skinId} hatId={hatId} />
    <CarouselCompanion shared={shared} character={character} skinId={skinId} hatId={hatId} antipodal />
  </group>;
}
