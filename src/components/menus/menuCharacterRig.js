import * as THREE from 'three';
import { createCharacterGeometry, applyCharacterFinish, prismColor, createCharacterAccents, poseCharacterAccents } from '../../worm/wormCharacterVisuals.js';
import { createWormSkinMaterial, updateWormSkinMaterialTime, applyBioluminescence } from '../../worm/wormSkinMaterial.js';
import { createMobiModel, animateMobi, orientMobi, disposeMobi } from '../../worm/mobiModel.js';
import { createMobiSegmentAssets, createMobiSegment, disposeMobiSegmentAssets } from '../../worm/mobiSegments.js';
import { finishWormEyes, wormBodyTaper } from '../../worm/wormCharacterFinish.js';
import { layoutWormFace, FACE_LAYOUT } from '../../worm/wormFaceLayout.js';
import { animateWormFace } from '../../worm/wormFaceExpression.js';
import { prefersReducedMotion } from '../../utils/device.js';
import { WORM_CHARACTERS } from '../../worm/wormCharacterData.js';
import { getSkin } from '../../worm/wormCosmeticsData.js';
import { makeWormHaloSprite } from '../../worm/wormGlowHalo.js';
import { SPINE_GEO_ARGS, PAGE_LAYER_COUNT, PAGE_LAYER_GAP, PAGE_HINGE_X, PAGE_HINGE_Y, PAGE_GEO_ARGS, PAGE_COLORS, createBookPageGeometry, createBookPaperMaterial, pageHingeAngles } from '../../worm/wormBookFX.js';
import { MENU_WORM_RADIUS, MENU_WORM_SEGMENTS } from './menuTunnelWormPath.js';

export const menuCharacterPair = cycle => [0, 1].map(i => WORM_CHARACTERS[((cycle * 2 + i) % WORM_CHARACTERS.length + WORM_CHARACTERS.length) % WORM_CHARACTERS.length].id);
const SKINS = { classic: 'slime', book: 'royal', inch: 'moss', glow: 'ice', wiggle: 'bubble', prism: 'royal', mobi: 'royal' };

// Menu rigs borrow the playable characters' geometry, paper, faces and MOBI assets.
// They follow the existing cube-local tunnel route; no extra renderer or canvas.
export function createMenuCharacterRig(character) {
  const group = new THREE.Group();
  group.name = `menu-character-${character}`;
  const skin = getSkin(SKINS[character]);
  const resources = new Set();
  const own = r => { resources.add(r); return r; };
  const geometry = own(createCharacterGeometry(character));
  const spine = character === 'book' ? own(new THREE.BoxGeometry(...SPINE_GEO_ARGS)) : null;
  const pageGeometries = character === 'book' ? [own(createBookPageGeometry(1)), own(createBookPageGeometry(-1))] : null;
  const accents = createCharacterAccents(character); group.add(accents.group);
  const mobi = character === 'mobi' ? createMobiModel() : null;
  const mobiAssets = mobi ? createMobiSegmentAssets() : null;
  const mobiTails = [];
  if (mobi) group.add(mobi.group);
  const segments = Array.from({ length: MENU_WORM_SEGMENTS }, (_, i) => {
    const holder = new THREE.Group(); group.add(holder);
    if (mobi) {
      if (i > 0 && i % 3 === 2) {
        const tail = createMobiSegment(mobiAssets); holder.add(tail.group);
        tail.group.scale.setScalar(.125); mobiTails.push(tail);
      }
      return { holder };
    }
    const material = own(createWormSkinMaterial({ color: skin.body, emissive: skin.body, emissiveIntensity: .12 }));
    applyCharacterFinish(material, character);
    applyBioluminescence(material, skin.glow, character === 'glow');
    const isBook = character === 'book' && i > 0;
    const body = new THREE.Mesh(isBook ? spine : geometry, material);
    const radius = i === 0 ? MENU_WORM_RADIUS : .12;
    body.scale.setScalar(radius * wormBodyTaper(i, MENU_WORM_SEGMENTS, character));
    holder.add(body);
    const hinges = [];
    if (isBook && i % 2 === 0) {
      for (const side of [1, -1]) {
        const hinge = new THREE.Group();
        hinge.position.set(side * PAGE_HINGE_X * radius, PAGE_HINGE_Y * radius, 0);
        for (let layer = 0; layer < PAGE_LAYER_COUNT; layer++) {
          const paper = own(createBookPaperMaterial()); paper.color.set(layer === 0 ? skin.body : PAGE_COLORS[layer % PAGE_COLORS.length]);
          const page = new THREE.Mesh(pageGeometries[side === 1 ? 0 : 1], paper);
          page.scale.setScalar(radius * 1.35);
          page.position.set(side * PAGE_GEO_ARGS[0] * radius * .675, layer * PAGE_LAYER_GAP * radius, 0);
          hinge.add(page);
        }
        holder.add(hinge); hinges.push(hinge);
      }
    }
    if (character === 'glow' && i % 2 === 0) {
      const halo = makeWormHaloSprite(); own(halo.material);
      halo.material.color.set(skin.glow); halo.scale.setScalar(.42); holder.add(halo);
    }
    return { holder, material, hinges };
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
  group.add(...faceParts);
  const side = new THREE.Vector3(), back = new THREE.Vector3(), basis = new THREE.Matrix4();
  return {
    group, segments,
    pose(i, position, normal, forward, visible, time) {
      const segment = segments[i]; segment.holder.visible = visible;
      segment.holder.position.copy(position);
      back.copy(forward).negate(); side.crossVectors(normal, back).normalize();
      basis.makeBasis(side, normal, back); segment.holder.quaternion.setFromRotationMatrix(basis);
      if (segment.material) {
        updateWormSkinMaterialTime(segment.material, time);
        if (character === 'prism') prismColor(segment.material.color, i, time);
        const hinges = pageHingeAngles(0, prefersReducedMotion() ? 0 : time);
        segment.hinges.forEach((hinge, index) => { hinge.rotation.z = index ? hinges.right : hinges.left; });
      }
      if (i === 0) {
        faceParts.forEach(part => { part.visible = visible && !mobi; });
        accents.group.visible = visible && !mobi;
        layoutWormFace(position, forward, normal, MENU_WORM_RADIUS, face);
        animateWormFace(face, character, time, { reducedMotion: prefersReducedMotion() });
        poseCharacterAccents(accents.group, position, forward, normal, MENU_WORM_RADIUS);
        if (mobi) {
          mobi.group.visible = visible; mobi.group.position.copy(position); mobi.group.scale.setScalar(MENU_WORM_RADIUS);
          orientMobi(mobi.group, forward, normal); animateMobi(mobi, time);
          for (const tail of mobiTails) {
            tail.core.material.uniforms.uTime.value = time;
            tail.gas.material.uniforms.uTime.value = time;
          }
        }
      }
    },
    dispose() {
      disposeEyes(); accents.dispose(); resources.forEach(r => r.dispose());
      if (mobi) { disposeMobi(mobi); mobiTails.forEach(t => t.core.material.dispose()); disposeMobiSegmentAssets(mobiAssets); }
    },
  };
}
