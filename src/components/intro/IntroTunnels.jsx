import React, { useMemo, useEffect, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { TILES } from './introTopology.js';
import { INTRO_STICKERS } from './introStickers.js';
import { sampleIntro } from './introChoreography.js';
import { introColor, stickerFlip, tunnelGrowth } from './introMotion.js';
import { PASSAGES, WORM_SEGMENTS, passagePoint, wormProgress, wormSegmentScale } from './introPassages.js';

const TUBULAR = 64, RADIAL = 12, BANDS = 7;
const ENDS = PASSAGES.map(pair => [TILES.indexOf(pair), TILES.findIndex(t => t.face.axis === pair.face.axis &&
  t.face.sign === -pair.face.sign && t.position.every((v, axis) => v === -pair.position[axis]))]);
const vertexShader = `varying vec2 vUv;
void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }`;
const fragmentShader = `uniform vec3 colorA, colorB; uniform float time, opacity; varying vec2 vUv;
void main() {
  vec3 color = mix(colorA, colorB, smoothstep(.25, .75, vUv.x));
  float helix = pow(.5 + .5 * cos(vUv.y * 12.566 - vUv.x * 37.7 + time * 3.), 16.);
  float pulse = pow(.5 + .5 * cos(vUv.x * 44. - time * 7.), 12.);
  gl_FragColor = vec4(mix(color, vec3(1.), helix * .45), opacity * (.18 + .38 * helix + .14 * pulse));
}`;

// Lit, depth-tested worms inside translucent flared passages. All per-frame
// geometry and instances reuse buffers; no TubeGeometry rebuilds or allocations.
export default function IntroTunnels({ time, reducedMotion }) {
  const root = useRef(), mouths = useRef(), rims = useRef(), bands = useRef();
  const worms = useRef(), whites = useRef(), pupils = useRef();
  const assets = useMemo(() => ({
    materials: PASSAGES.map(() => new THREE.ShaderMaterial({ vertexShader, fragmentShader,
      transparent: true, depthWrite: false, side: THREE.DoubleSide,
      uniforms: { colorA: { value: new THREE.Color() }, colorB: { value: new THREE.Color() },
        time: { value: 0 }, opacity: { value: 0 } } })),
    geometries: PASSAGES.map(() => new THREE.TubeGeometry(new THREE.LineCurve3(
      new THREE.Vector3(), new THREE.Vector3(0, 0, 1)), TUBULAR, 1, RADIAL, false)),
    dummy: new THREE.Object3D(), a: new THREE.Vector3(), b: new THREE.Vector3(), tangent: new THREE.Vector3(),
    right: new THREE.Vector3(), up: new THREE.Vector3(), point: new THREE.Vector3(), z: new THREE.Vector3(0, 0, 1),
    color: new THREE.Color(), colors: Array.from({ length: 7 }, (_, id) => new THREE.Color(id ? introColor(id) : '#fff'))
  }), []);
  useEffect(() => () => { assets.materials.forEach(m => m.dispose()); assets.geometries.forEach(g => g.dispose()); }, [assets]);
  useFrame(() => {
    const pose = sampleIntro(time, reducedMotion);
    root.current.visible = pose.passage > 0.001;
    if (!root.current.visible) return;
    const spacing = 1 + 1.5 * pose.open;
    const { a, b, tangent, right, up, point, dummy, z, color } = assets;
    const frame = (pair, u) => {
      passagePoint(pair, u, spacing, a);
      passagePoint(pair, u > .999 ? u - .001 : u + .001, spacing, b);
      tangent.subVectors(b, a).normalize().multiplyScalar(u > .999 ? -1 : 1);
      up.set(0, 1, 0); right.crossVectors(tangent, up);
      if (right.lengthSq() < .001) right.crossVectors(tangent, up.set(0, 0, 1));
      right.normalize(); up.crossVectors(right, tangent).normalize();
    };
    const stamp = (mesh, index, scale, tint) => {
      dummy.scale.setScalar(scale); dummy.updateMatrix(); mesh.setMatrixAt(index, dummy.matrix);
      if (tint) mesh.setColorAt(index, tint);
    };
    PASSAGES.forEach((pair, index) => {
      const [near, far] = ENDS[index];
      const first = assets.colors[INTRO_STICKERS[+stickerFlip(TILES[near], time, reducedMotion).flipped][near].curr];
      const second = assets.colors[INTRO_STICKERS[+stickerFlip(TILES[far], time, reducedMotion).flipped][far].curr];
      const material = assets.materials[index];
      material.uniforms.colorA.value.copy(first); material.uniforms.colorB.value.copy(second);
      material.uniforms.time.value = time; material.uniforms.opacity.value = pose.passage;
      const grow = tunnelGrowth(index * 3, time, reducedMotion);
      const geometry = assets.geometries[index];
      geometry.setDrawRange(0, Math.round(grow * TUBULAR) * RADIAL * 6);
      const positions = geometry.attributes.position;
      for (let j = 0; j <= TUBULAR; j++) {
        const u = j / TUBULAR;
        frame(pair, u);
        const radius = .235 + .105 * Math.exp(-Math.min(u, 1 - u) * 24);
        for (let k = 0; k <= RADIAL; k++) {
          const angle = k / RADIAL * Math.PI * 2;
          point.copy(a).addScaledVector(right, Math.cos(angle) * radius).addScaledVector(up, Math.sin(angle) * radius);
          positions.setXYZ(j * (RADIAL + 1) + k, point.x, point.y, point.z);
        }
      }
      positions.needsUpdate = true;
      for (let end = 0; end < 2; end++) {
        frame(pair, end);
        dummy.position.copy(a); dummy.quaternion.setFromUnitVectors(z, tangent);
        const opening = Math.min(1, Math.max(0, grow * 2 - end)) * pose.passage;
        stamp(mouths.current, index * 2 + end, opening);
        // A dark inset with a raised coloured lip, seated on its sticker.
        dummy.position.setComponent(pair.face.axis, a.getComponent(pair.face.axis) + (end ? -.015 : .015));
        stamp(rims.current, index * 2 + end, opening, end ? second : first);
      }
      for (let ring = 0; ring < BANDS; ring++) {
        const u = (ring + 1) / (BANDS + 1);
        frame(pair, u); dummy.position.copy(a); dummy.quaternion.setFromUnitVectors(z, tangent);
        stamp(bands.current, index * BANDS + ring, u < grow ? pose.passage : 0, color.copy(first).lerp(second, u));
      }
      const progress = wormProgress(time, index);
      for (let j = 0; j < WORM_SEGMENTS; j++) {
        const u = progress - j * .018;
        frame(pair, u); dummy.position.copy(a); dummy.quaternion.setFromUnitVectors(z, tangent);
        const size = pose.wormVisible ? wormSegmentScale(u, j) : 0;
        dummy.scale.set(size, size, size * 1.18); dummy.updateMatrix();
        worms.current.setMatrixAt(index * WORM_SEGMENTS + j, dummy.matrix);
        worms.current.setColorAt(index * WORM_SEGMENTS + j, color.copy(first).lerp(second, THREE.MathUtils.smoothstep(u, .35, .65)));
      }
      frame(pair, progress);
      const alive = pose.wormVisible ? wormSegmentScale(progress, 0) / .205 : 0;
      for (let eye = 0; eye < 2; eye++) {
        dummy.position.copy(a).addScaledVector(right, eye ? .085 : -.085).addScaledVector(up, .13).addScaledVector(tangent, .12);
        dummy.quaternion.identity(); stamp(whites.current, index * 2 + eye, .077 * alive);
        dummy.position.addScaledVector(tangent, .052).addScaledVector(up, .017);
        stamp(pupils.current, index * 2 + eye, .036 * alive);
      }
    });
    for (const ref of [mouths, rims, bands, worms, whites, pupils]) {
      ref.current.instanceMatrix.needsUpdate = true;
      if (ref.current.instanceColor) ref.current.instanceColor.needsUpdate = true;
    }
  });
  return <group ref={root}>
    {PASSAGES.map((_, i) => <mesh key={i} geometry={assets.geometries[i]} material={assets.materials[i]} dispose={null} frustumCulled={false} />)}
    <instancedMesh ref={mouths} args={[null, null, PASSAGES.length * 2]} frustumCulled={false}>
      <circleGeometry args={[.32, 32]} /><meshStandardMaterial color="#101729" roughness={.4} side={THREE.DoubleSide} />
    </instancedMesh>
    <instancedMesh ref={rims} args={[null, null, PASSAGES.length * 2]} frustumCulled={false}>
      <torusGeometry args={[.335, .055, 10, 36]} /><meshStandardMaterial roughness={.23} metalness={.25} />
    </instancedMesh>
    <instancedMesh ref={bands} args={[null, null, PASSAGES.length * BANDS]} frustumCulled={false}>
      <torusGeometry args={[.24, .012, 5, 20]} /><meshStandardMaterial transparent opacity={.55} depthWrite={false} roughness={.3} />
    </instancedMesh>
    <instancedMesh ref={worms} args={[null, null, PASSAGES.length * WORM_SEGMENTS]} frustumCulled={false}>
      <sphereGeometry args={[1, 16, 12]} /><meshPhysicalMaterial roughness={.28} clearcoat={1} clearcoatRoughness={.2} />
    </instancedMesh>
    <instancedMesh ref={whites} args={[null, null, PASSAGES.length * 2]} frustumCulled={false}>
      <sphereGeometry args={[1, 12, 8]} /><meshStandardMaterial color="#fffdf2" roughness={.24} />
    </instancedMesh>
    <instancedMesh ref={pupils} args={[null, null, PASSAGES.length * 2]} frustumCulled={false}>
      <sphereGeometry args={[1, 10, 8]} /><meshStandardMaterial color="#101729" roughness={.2} />
    </instancedMesh>
  </group>;
}
