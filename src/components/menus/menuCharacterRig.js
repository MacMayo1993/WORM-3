import * as THREE from 'three';
import { createCharacterGeometry, applyCharacterFinish, prismColor, createCharacterAccents, poseCharacterAccents, characterSegmentPattern } from '../../worm/wormCharacterVisuals.js';
import { createWormSkinMaterial, updateWormSkinMaterialTime, applyBioluminescence, applySkinMaterialProfile } from '../../worm/wormSkinMaterial.js';
import { BUMP_STYLES, getSkinFX } from '../../worm/wormSkinFX.js';
import { createMobiModel, animateMobi, orientMobi, disposeMobi } from '../../worm/mobiModel.js';
import { createMobiSegmentAssets, createMobiSegment, disposeMobiSegmentAssets, mobiTailSwayInto } from '../../worm/mobiSegments.js';
import { finishWormEyes, wormBodyTaper } from '../../worm/wormCharacterFinish.js';
import { layoutWormFace, FACE_LAYOUT } from '../../worm/wormFaceLayout.js';
import { animateWormFace } from '../../worm/wormFaceExpression.js';
import { prefersReducedMotion } from '../../utils/device.js';
import { getSkin } from '../../worm/wormCosmeticsData.js';
import { makeWormHaloSprite } from '../../worm/wormGlowHalo.js';
import { createBookParts, createBookSegment, createBookBindingMaterial, poseBookSegment, bookScaleForRadius, bookVolumeScale, bookGroundLift } from '../../worm/wormBookFX.js';
import { MENU_WORM_RADIUS, MENU_WORM_BODY_RADIUS, MENU_WORM_SEGMENTS } from './menuTunnelWormPath.js';
import { createMenuWormFinish } from './menuWormFinish.js';
import { createWormReaction, pokeWorm, wagWorm, aimWormHead, wormReactionFaceInto, wormReactionSegmentInto } from './menuWormReaction.js';
import { wearMenuWormHat } from './menuWormHat.js';

// Each species wears a skin that tells it apart from the other five at menu
// size: the Ranger's slime green, the Brute's molten lava, the Scout's sea
// glow, the Dancer's cherry gloss, the Sage's and Trickster's royal purple.
export const MENU_CHARACTER_SKINS = { classic: 'slime', book: 'royal', inch: 'lava', glow: 'ocean', wiggle: 'cherry', prism: 'royal', mobi: 'royal' };

// How far a menu worm's head travels between two trail dots.
const TRAIL_SPACING = 0.075;
// The Scout's bioluminescence, toned for a lit menu: in play it is 1.2, which
// over a bright photo or the carousel's paper burns every bead to one flat hue.
const MENU_GLOW = { base: 0.55, amp: 0.25, speed: 2.4 };

const _ink = new THREE.Color(), _white = new THREE.Color('#ffffff');
/** The outline is the skin's own darkest colour, never a flat black. */
export function menuWormInk(skin, out = new THREE.Color()) {
  return out.set(skin.belly).lerp(_ink.set('#14101c'), 0.72);
}

// Skin FX are uniforms on a program the material only gets on first compile:
// set them then, or a bumpy skin renders smooth.
function syncSkinBump(material, fx) {
  if (material.userData.menuBumpSynced) return;
  const shader = material.userData.shader;
  if (!shader) return;
  const bump = material.userData.menuNoBump ? { style: 'none' } : fx.bump || { style: 'none' };
  shader.uniforms.uStyle.value = BUMP_STYLES[bump.style] ?? 0;
  shader.uniforms.uAmp.value = bump.amp ?? 0;
  shader.uniforms.uFreq.value = bump.freq ?? 1;
  shader.uniforms.uSpeed.value = bump.speed ?? 1;
  shader.uniforms.uSeed.value = material.userData.seed ?? 0;
  material.userData.menuBumpSynced = true;
}

/**
 * Menu rigs borrow the playable characters' geometry, skins, faces and MOBI
 * assets, then add the menu finish (ink outline, contact shadows, slime trail).
 * They follow the caller's cube-local route; no extra renderer or canvas.
 *
 * @param {string} character
 * @param {object} [options]
 * @param {string} [options.skinId]       defaults to the species' menu skin
 * @param {number} [options.segments]
 * @param {number} [options.headRadius]
 * @param {number} [options.bodyRadius]
 * @param {number} [options.clearance]    how far the route runs above the surface
 * @param {boolean} [options.finish]      outline, shadows and trail
 */
export function createMenuCharacterRig(character, options = {}) {
  const {
    skinId = MENU_CHARACTER_SKINS[character] ?? 'slime',
    segments: count = MENU_WORM_SEGMENTS,
    headRadius = MENU_WORM_RADIUS,
    bodyRadius = MENU_WORM_BODY_RADIUS,
    clearance = MENU_WORM_RADIUS * 0.86,
    finish: wantsFinish = true,
    inkWidth,
  } = options;
  const group = new THREE.Group();
  group.name = `menu-character-${character}`;
  const skin = getSkin(skinId);
  const fx = getSkinFX(skinId);
  const resources = new Set();
  const own = r => { resources.add(r); return r; };
  const geometry = own(createCharacterGeometry(character));
  const bookParts = character === 'book' ? createBookParts() : null;
  if (bookParts) Object.values(bookParts).forEach(own);
  const accents = createCharacterAccents(character);
  accents.setSkin(skin);
  const mobi = character === 'mobi' ? createMobiModel() : null;
  const mobiAssets = mobi ? createMobiSegmentAssets() : null;
  const mobiTails = [];
  const segments = Array.from({ length: count }, (_, i) => {
    const holder = new THREE.Group(); group.add(holder);
    if (mobi) {
      if (i > 0 && i % 3 === 2) {
        const tail = createMobiSegment(mobiAssets); holder.add(tail.group);
        tail.group.scale.setScalar(bodyRadius * 1.04 * wormBodyTaper(i, count, character)); mobiTails.push(tail);
        return { holder, mobiTail: tail };
      }
      return { holder };
    }
    const radius = i === 0 ? headRadius : bodyRadius;
    const taper = wormBodyTaper(i, count, character);
    if (bookParts && i > 0) {
      // A volume in the bead's place, fore-edges resting where its belly would.
      const binding = own(createBookBindingMaterial());
      characterSegmentPattern(binding.color.set(skin.body), character, skin, i, new THREE.Color());
      const book = createBookSegment(bookParts, binding);
      const scale = bookScaleForRadius(radius) * bookVolumeScale(i) * taper;
      book.group.scale.setScalar(scale);
      book.group.position.y = bookGroundLift(scale, radius);
      holder.add(book.group);
      return { holder, material: null, book, radius: radius * taper };
    }
    const material = own(createWormSkinMaterial({ color: skin.body, emissive: skin.body }));
    // The skin's own personality (gloss, sheen, metal, bumps), as in play.
    applySkinMaterialProfile(material, fx, i);
    // Glass skins would need a transmission pass for a few beads on a menu.
    material.transmission = 0;
    material.thickness = 0;
    // Under the menus' studio rig and reflection map an untone-mapped body
    // blows out to a pale wash (slime green came out mint white on the
    // carousel); tone mapped, it keeps its hue and the highlights roll off.
    material.toneMapped = true;
    material.sheen = Math.min(material.sheen, 0.25);
    characterSegmentPattern(material.color, character, skin, i, new THREE.Color());
    applyBioluminescence(material, skin.glow, character === 'glow');
    applyCharacterFinish(material, character);
    if (character === 'glow') material.userData.pulse = { ...MENU_GLOW };
    if (character === 'prism') material.userData.menuNoBump = true;
    const body = new THREE.Mesh(geometry, material);
    body.scale.setScalar(radius * taper);
    holder.add(body);
    if (character === 'glow' && i % 2 === 0) {
      const halo = makeWormHaloSprite(); own(halo.material);
      halo.visible = true;
      halo.material.color.set(skin.glow);
      halo.material.opacity *= 0.55;
      halo.scale.setScalar(radius * 3);
      holder.add(halo);
    }
    return { holder, material, body, book: null, radius: radius * taper };
  });
  const eyeGeo = own(new THREE.SphereGeometry(1, 14, 12));
  const white = own(new THREE.MeshPhysicalMaterial({ color: '#f1f3e9', roughness: .22, clearcoat: 1 }));
  const black = own(new THREE.MeshBasicMaterial({ color: '#12131a' }));
  const face = { eyes: [0,1].map(() => new THREE.Mesh(eyeGeo, white)), pupils: [0,1].map(() => new THREE.Mesh(eyeGeo, black)),
    mouth: new THREE.Mesh(own(new THREE.BufferGeometry()), black), glasses: [null, null], hat: null };
  if (character === 'book') {
    const glassGeo = own(new THREE.TorusGeometry(1, FACE_LAYOUT.glassTube / FACE_LAYOUT.glassRadius, 8, 18));
    const brass = own(new THREE.MeshStandardMaterial({ color: '#b98739', metalness: .65, roughness: .3 }));
    face.glasses = [0,1].map(() => new THREE.Mesh(glassGeo, brass));
  }
  const disposeEyes = finishWormEyes(face.eyes, face.pupils, character, face.mouth);
  const faceParts = [...face.eyes, ...face.pupils, face.mouth, ...face.glasses].filter(Boolean);
  // Head features share the animated holder so its squash/stretch cannot leave
  // the eyes, mouth, accessories or MOBI shell floating at the old pose.
  segments[0].holder.add(...faceParts, accents.group);
  if (mobi) segments[0].holder.add(mobi.group);

  // MOBI is his own glass-and-block model; every bead-bodied worm is inked.
  const finish = wantsFinish ? createMenuWormFinish({
    geometry: mobi ? null : geometry,
    segments: count,
    ink: menuWormInk(skin),
    inkWidth,
    glow: new THREE.Color(skin.glow).lerp(_white, 0.15),
    trailOpacity: character === 'glow' ? 0.85 : 0.6,
  }) : null;
  if (finish) group.add(finish.group);

  const mobiSway = { roll: 0, pitch: 0, yaw: 0, lift: 0 };
  const side = new THREE.Vector3(), back = new THREE.Vector3(), basis = new THREE.Matrix4();
  const origin = new THREE.Vector3(), localUp = new THREE.Vector3(0, 1, 0), localForward = new THREE.Vector3(0, 0, -1);
  const surface = new THREE.Vector3(), lastDrop = new THREE.Vector3();
  // World down in the rig's own space, from last frame's transform: shadows
  // fall that way across the face, so a camera looking straight at the face
  // still sees them past the body instead of hidden right under it.
  const down = new THREE.Vector3(), inverse = new THREE.Matrix4(), cast = new THREE.Vector3(), fall = new THREE.Vector3();
  const updateDown = () => {
    inverse.copy(group.matrixWorld).invert();
    down.set(0, -1, 0).transformDirection(inverse);
  };
  let hasDropped = false;
  // The player's side of things: what the worm looks at, a poke, a wag.
  const reaction = createWormReaction();
  const faceMood = { surprise: 0, delight: 0, look: null };
  const lookWorld = new THREE.Vector3(), lookLocal = new THREE.Vector3(), headWorld = new THREE.Matrix4();
  let looking = false, now = 0, dizzy = 0, live = true, startle = 0, delightBoost = 0;
  const glowColor = new THREE.Color(_ink.set(skin.glow).lerp(_white, 0.15));
  const headSurface = new THREE.Vector3(), headNormal = new THREE.Vector3(0, 1, 0);
  let headTime = 0, headSeen = false;
  const scratch = { width: 1, stretch: 1, lift: 0, sway: 0, roll: 0, pulse: 0, transit: false, ground: 1 };
  let hat = null;
  return {
    group, segments, finish, skin, reaction,
    /**
     * Before posing a frame: the real-time clock `at` (seconds), what to look
     * at (`lookAt`, a world point, or null), and the mood (`dizzy`,
     * `surprise` and `delight`, each 0…1, on top of a poke's own). `active`
     * false freezes reactions (a hidden or paused worm).
     */
    react(at, { lookAt = null, dizzy: giddy = 0, surprise = 0, delight = 0, active = true } = {}) {
      now = at;
      looking = !!lookAt;
      if (lookAt) lookWorld.copy(lookAt);
      dizzy = giddy;
      startle = surprise;
      delightBoost = delight;
      live = active;
    },
    /** Tint the trail and sparks (null puts the skin's own glow back). */
    setGlow(color) { finish?.setGlow(color ?? glowColor); },
    /** Startle the worm: it flinches, hops and grins; sparks fly off its head. */
    poke(at = now, reducedMotion = prefersReducedMotion()) {
      pokeWorm(reaction, at);
      if (!reducedMotion && headSeen) finish?.burst(headSurface, headNormal, headRadius, headTime, { count: 10, speed: 1.1 });
    },
    /** A friendly flick of the tail. */
    wag(at = now) { wagWorm(reaction, at); },
    /** A ring of sparks off the head (a mood's zap or glint). */
    sparkle(options) { if (headSeen) finish?.burst(headSurface, headNormal, headRadius, headTime, options); },
    /** A ring of sparks round a point on the surface (a portal's mouth). */
    burst(center, normal, time, options) { finish?.burst(center, normal, headRadius, time, options); },
    /** Wear hat `id` (a felt hat appears once its chunk has loaded). */
    setHat(id) {
      hat?.dispose();
      hat = mobi || !id || id === 'none' ? null : wearMenuWormHat(segments[0].holder, id, headRadius);
    },
    /** Where segment `i` is, in world space (last frame's transforms). */
    segmentWorldInto(i, out) { return segments[i].holder.getWorldPosition(out); },
    pose(i, position, normal, forward, visible, time, motion = null, reducedMotion = prefersReducedMotion()) {
      const segment = segments[i]; segment.holder.visible = visible;
      const m = Object.assign(scratch, { width: 1, stretch: 1, lift: 0, sway: 0, roll: 0, pulse: 0, transit: false, ground: 1 }, motion);
      if (live) wormReactionSegmentInto(m, reaction, i, count, now, segment.radius ?? headRadius, reducedMotion);
      segment.holder.position.copy(position);
      back.copy(forward).negate(); side.crossVectors(normal, back).normalize();
      basis.makeBasis(side, normal, back); segment.holder.quaternion.setFromRotationMatrix(basis);
      segment.holder.scale.set(m.width, m.width, m.stretch);
      segment.holder.position.addScaledVector(normal, m.lift).addScaledVector(side, m.sway);
      segment.holder.rotateZ(m.roll);
      if (i === 0) {
        // Turn the head toward what it is looking at, in its own frame.
        let dir = null;
        if (looking && visible && live) {
          segment.holder.updateMatrix();
          headWorld.multiplyMatrices(group.matrixWorld, segment.holder.matrix).invert();
          lookLocal.copy(lookWorld).applyMatrix4(headWorld);
          if (lookLocal.lengthSq() > 1e-6) dir = lookLocal.normalize();
        }
        aimWormHead(reaction, dir, now, reducedMotion);
        segment.holder.rotateY(reaction.yaw);
        segment.holder.rotateX(reaction.pitch);
      }
      if (segment.material) {
        syncSkinBump(segment.material, fx);
        updateWormSkinMaterialTime(segment.material, time);
        if (character === 'prism') prismColor(segment.material.color, i, time);
      }
      if (segment.book) poseBookSegment(segment.book, m.pulse, reducedMotion ? 0 : time, i);
      if (segment.mobiTail) {
        const sway = mobiTailSwayInto(mobiSway, i / 3, time * 0.6, time, reducedMotion);
        segment.mobiTail.group.rotation.set(sway.pitch, sway.yaw, sway.roll);
        segment.mobiTail.group.position.y = sway.lift * bodyRadius * 1.04;
      }
      if (finish) {
        const ground = visible ? m.ground : 0;
        finish.outlineSegment(i, segment.holder, segment.body, visible);
        // Shadows pool under the segment on the sticker below it, shrinking
        // as the segment arches away from the surface.
        if (i === 0) updateDown();
        surface.copy(position).addScaledVector(normal, -clearance);
        const r = segment.radius ?? bodyRadius;
        const arch = Math.max(0, m.lift) / Math.max(1e-4, r);
        // Down across the face; on a face turned to the floor or the sky,
        // where down has nowhere to go, the shadow stays underneath.
        fall.copy(down).addScaledVector(normal, -down.dot(normal));
        cast.copy(surface).addScaledVector(fall, r * 0.55 * (1 + arch * 0.5));
        finish.shadowSegment(i, cast, normal, r, ground * (1 - Math.min(0.6, arch * 0.6)));
        if (i === 0) {
          headSurface.copy(surface); headNormal.copy(normal); headTime = time; headSeen = visible && ground > 0.5;
          // The head lays the trail: one dot per short stretch of road travelled.
          if (visible && ground > 0.5) {
            if (!hasDropped || lastDrop.distanceToSquared(surface) > TRAIL_SPACING * TRAIL_SPACING) {
              finish.emitTrail(surface, normal, headRadius * 2.1, time);
              lastDrop.copy(surface); hasDropped = true;
            }
          } else hasDropped = false;
        }
      }
      if (i === 0) {
        faceParts.forEach(part => { part.visible = visible && !mobi; });
        accents.group.visible = visible && !mobi;
        wormReactionFaceInto(faceMood, reaction, now, reducedMotion);
        faceMood.surprise = Math.max(faceMood.surprise, startle);
        const pulse = Math.max(m.pulse, faceMood.delight, delightBoost);
        layoutWormFace(origin, localForward, localUp, headRadius, face);
        animateWormFace(face, character, time, {
          reducedMotion, pulse, transit: m.transit, look: faceMood.look, surprise: faceMood.surprise, dizzy,
        });
        poseCharacterAccents(accents.group, origin, localForward, localUp, headRadius);
        accents.update(reducedMotion ? 0 : time);
        hat?.pose(reducedMotion ? 0 : time);
        if (mobi) {
          mobi.group.visible = visible; mobi.group.position.copy(origin); mobi.group.scale.setScalar(headRadius);
          orientMobi(mobi.group, localForward, localUp);
          animateMobi(mobi, reducedMotion ? 0 : time, { pulse, transit: m.transit });
          for (const tail of mobiTails) {
            tail.core.material.uniforms.uTime.value = time;
            tail.gas.material.uniforms.uTime.value = time;
          }
        }
      }
    },
    /** After every segment is posed: upload the finish's instances. */
    endFrame(time, reducedMotion = prefersReducedMotion()) {
      finish?.update(time, reducedMotion);
    },
    /** Forget the trail, e.g. when the worm is about to reappear elsewhere. */
    resetTrail() { finish?.clearTrail(); hasDropped = false; },
    dispose() {
      hat?.dispose();
      disposeEyes(); accents.dispose(); resources.forEach(r => r.dispose()); finish?.dispose();
      if (mobi) { disposeMobi(mobi); mobiTails.forEach(t => t.core.material.dispose()); disposeMobiSegmentAssets(mobiAssets); }
    },
  };
}
