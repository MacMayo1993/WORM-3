// src/worm/healerWorm/healBurstRig.js
//
// One pooled heal shockwave (HealBurstSystem in healFx.jsx plays four of them, so two
// heals can overlap): an outer ring, an inner ring, a flash and, for a double heal, a
// second wave. Shared geometry and one additive program, built once and warmed with
// the scene while scrambling. The old version mounted a React component (three
// geometries and three materials) per burst from a setState inside useFrame: a
// commit and a possible program link on the exact frame the reward landed.
import * as THREE from 'three';

const BURST_SECONDS = 0.95;
const WAVE_DELAY = 0.18;
const _outerGeo = new THREE.RingGeometry(0.34, 0.5, 48);
const _coreGeo = new THREE.RingGeometry(0.16, 0.28, 40);
const _flashGeo = new THREE.SphereGeometry(0.3, 16, 16);
const easeOut = (p) => 1 - Math.pow(1 - p, 3);

function burstMaterial(color) {
  return new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity: 0,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false
  });
}

export function makeBurstRig() {
  const group = new THREE.Group();
  group.name = 'heal-burst';
  group.visible = false;
  const outer = new THREE.Mesh(_outerGeo, burstMaterial('#3affb0'));
  const wave = new THREE.Mesh(_outerGeo, burstMaterial('#3affb0'));
  const core = new THREE.Mesh(_coreGeo, burstMaterial('#ffffff'));
  const flash = new THREE.Mesh(_flashGeo, burstMaterial('#3affb0'));
  flash.position.z = 0.06;
  for (const mesh of [outer, wave, core, flash]) {
    mesh.raycast = () => null;
    group.add(mesh);
  }
  return { group, outer, wave, core, flash, tile: null, t: 0, tier: 1, active: false };
}

const WHITE = new THREE.Color('#ffffff');

/** Colour a rig for the tile it lands on: its home colour, lifted toward white. */
export function tintBurstRig(rig, color) {
  rig.outer.material.color.set(color).lerp(WHITE, 0.4);
  rig.wave.material.color.copy(rig.outer.material.color);
  rig.flash.material.color.copy(rig.outer.material.color);
}

/** Animate one rig at time t (seconds since its heal); false once it has finished. */
export function poseBurstRig(rig, t) {
  const big = rig.tier === 2 ? 1.35 : 1;
  const p = Math.min(1, t / BURST_SECONDS);
  const s = (0.15 + easeOut(p) * 1.75) * big;
  rig.outer.scale.set(s, s, 1);
  rig.outer.material.opacity = (1 - p) * 0.9;
  const p2 = Math.min(1, t / (BURST_SECONDS * 0.65));
  const s2 = (0.1 + easeOut(p2) * 1.05) * big;
  rig.core.scale.set(s2, s2, 1);
  rig.core.material.opacity = (1 - p2) * 0.75;
  const fp = Math.min(1, t / 0.28);
  rig.flash.scale.setScalar((0.2 + fp * 0.95) * big);
  rig.flash.material.opacity = (1 - fp) * 0.85;
  const wp = rig.tier === 2 ? Math.min(1, Math.max(0, t - WAVE_DELAY) / BURST_SECONDS) : 1;
  const sw = (0.15 + easeOut(wp) * 2.1) * big;
  rig.wave.visible = rig.tier === 2 && t >= WAVE_DELAY && wp < 1;
  rig.wave.scale.set(sw, sw, 1);
  rig.wave.material.opacity = (1 - wp) * 0.7;
  return t < BURST_SECONDS + (rig.tier === 2 ? WAVE_DELAY : 0);
}
