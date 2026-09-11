import { finishWormEyes, wormBodyTaper } from '../../worm/wormCharacterFinish.js';
import React, { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { createWormSkinMaterial, updateWormSkinMaterialTime } from '../../worm/wormSkinMaterial.js';
import { layoutWormFace, FACE_LAYOUT, MOUTH_ARC } from '../../worm/wormFaceLayout.js';
import { isCarouselActive } from './menuCarouselState.js';
import { makeMenuTunnelWormPath, sampleMenuTunnelWorm, MENU_WORM_RADIUS, MENU_WORM_SEGMENTS, MENU_WORM_SPACING, MENU_WORM_SPEED } from './menuTunnelWormPath.js';

// Mounted INSIDE the cube's transform. No screen coordinates or independent
// world-space movement: carousel turns, wobble, scale and dive carry every part.
export default function MenuWormParticle({ start, color1, elapsed, arcPhase = 0, antipodal = false, delay = 0, onComplete }) {
  const path = useMemo(() => makeMenuTunnelWormPath(start, arcPhase), [start, arcPhase]);
  const completed = useRef(false);
  const model = useMemo(() => {
    const group = new THREE.Group();
    group.visible = false;
    const geometry = new THREE.SphereGeometry(1, 16, 12);
    const tint = new THREE.Color(color1).lerp(new THREE.Color('#ffffff'), 0.24);
    const material = createWormSkinMaterial({ color: tint, emissive: tint, emissiveIntensity: 0.65, roughness: 0.3, clearcoat: 0.8 });
    const beads = [];
    for (let i = 0; i < MENU_WORM_SEGMENTS; i++) {
      const bead = new THREE.Mesh(geometry, material);
      bead.scale.setScalar((i === 0 ? MENU_WORM_RADIUS : 0.12) * wormBodyTaper(i, MENU_WORM_SEGMENTS, 'wiggle'));
      group.add(bead); beads.push(bead);
    }
    const white = new THREE.MeshPhysicalMaterial({ color: '#f1f3e9', roughness: 0.22, clearcoat: 1 });
    const black = new THREE.MeshBasicMaterial({ color: '#12131a' });
    const eyes = [0, 1].map(() => new THREE.Mesh(geometry, white));
    const pupils = [0, 1].map(() => new THREE.Mesh(geometry, black));
    const disposeEyes = finishWormEyes(eyes, pupils);
    const mouthGeo = new THREE.TorusGeometry(1, FACE_LAYOUT.mouthTube / FACE_LAYOUT.mouthRadius, 8, 22, MOUTH_ARC);
    const mouth = new THREE.Mesh(mouthGeo, black);
    group.add(...eyes, ...pupils, mouth);
    return { group, beads, material, face: { eyes, pupils, mouth, glasses: [null, null], hat: null },
      position: new THREE.Vector3(), normal: new THREE.Vector3(), forward: new THREE.Vector3(),
      dispose() { disposeEyes(); geometry.dispose(); material.dispose(); white.dispose(); black.dispose(); mouthGeo.dispose(); } };
  }, [color1]);
  useEffect(() => () => model.dispose(), [model]);
  useFrame(() => {
    model.group.visible = !isCarouselActive();
    if (!model.group.visible) return;
    const time = elapsed.current - delay;
    const distance = time * MENU_WORM_SPEED;
    updateWormSkinMaterialTime(model.material, elapsed.current);
    model.beads.forEach((bead, i) => {
      bead.visible = sampleMenuTunnelWorm(path, distance - i * MENU_WORM_SPACING, model.position, model.normal, model.forward);
      if (antipodal) { model.position.negate(); model.normal.negate(); model.forward.negate(); }
      bead.position.copy(model.position);
      if (i === 0) {
        layoutWormFace(model.position, model.forward, model.normal, MENU_WORM_RADIUS, model.face);
        [...model.face.eyes, ...model.face.pupils, model.face.mouth].forEach(part => { part.visible = bead.visible; });
      }
    });
    if (!completed.current && time >= path.duration) {
      completed.current = true;
      onComplete?.();
    }
  });
  return <primitive object={model.group} dispose={null} />;
}
