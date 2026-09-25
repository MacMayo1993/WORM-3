// BackgroundAmbience — the sky around the puzzle comes alive without touching it.
//
// Small Rubik's cubes (every face its real cube colour, dark gaps between the
// stickers) tumble slowly along great circles, and wormholes turn in the far
// distance in antipodal twin pairs. Layout, counts and the "always beyond the
// camera" rule live in backgroundAmbience.js; this file only draws them.
//
// Budget: one instanced mesh for all cubes and two draws per portal. The
// reduced-effects tier halves the counts; reduced motion freezes the scene.
// Nothing here is pickable, so taps and drags always reach the cube.
import React, { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useGameStore } from '../hooks/useGameStore.js';
import { RUBIKS_FACE_COLORS } from '../utils/constants.js';
import { prefersReducedMotion } from '../utils/device.js';
import { ambienceLayout, cubePositionAt } from './backgroundAmbience.js';

const noRaycast = () => null;
// BoxGeometry face order: +X, -X, +Y, -Y, +Z, -Z → face IDs 5, 2, 3, 6, 1, 4.
const BOX_FACE_IDS = [5, 2, 3, 6, 1, 4];

function stickerGridTexture() {
  const size = 128, gap = 8, cell = (size - gap * 4) / 3;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#16181a';
  ctx.fillRect(0, 0, size, size);
  ctx.fillStyle = '#ffffff';
  for (let row = 0; row < 3; row++) for (let col = 0; col < 3; col++) {
    const x = gap + col * (cell + gap), y = gap + row * (cell + gap);
    ctx.beginPath();
    ctx.roundRect ? ctx.roundRect(x, y, cell, cell, 6) : ctx.rect(x, y, cell, cell);
    ctx.fill();
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

function cubeGeometry() {
  const geometry = new THREE.BoxGeometry(1, 1, 1);
  const colors = new Float32Array(geometry.attributes.position.count * 3);
  const color = new THREE.Color();
  // Flat toy colours with shading baked per face (top lit, sides stepped
  // down), so the cubes read the same under a bright sky or a black hole.
  const SHADE = [0.86, 0.72, 1, 0.62, 0.94, 0.78];
  BOX_FACE_IDS.forEach((faceId, face) => {
    color.set(RUBIKS_FACE_COLORS[faceId]).multiplyScalar(SHADE[face]);
    for (let v = face * 4; v < face * 4 + 4; v++) color.toArray(colors, v * 3);
  });
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return geometry;
}

const PORTAL_VERTEX = /* glsl */`
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const PORTAL_FRAGMENT = /* glsl */`
  uniform float time; uniform vec3 colorA; uniform vec3 colorB;
  varying vec2 vUv;
  void main() {
    vec2 p = vUv * 2.0 - 1.0;
    float r = length(p);
    if (r > 1.0) discard;
    float angle = atan(p.y, p.x);
    float swirl = 0.5 + 0.5 * sin(angle * 3.0 + r * 11.0 - time * 1.4);
    vec3 color = mix(colorA, colorB, swirl * smoothstep(0.1, 0.9, r));
    float core = smoothstep(0.05, 0.55, r);
    float edge = 1.0 - smoothstep(0.82, 1.0, r);
    gl_FragColor = vec4(color * (0.35 + 0.65 * core), (0.25 + 0.6 * core) * edge);
  }`;

function Portal({ portal, clock }) {
  const group = useRef(null);
  const material = useMemo(() => new THREE.ShaderMaterial({
    vertexShader: PORTAL_VERTEX,
    fragmentShader: PORTAL_FRAGMENT,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    uniforms: {
      time: { value: 0 },
      colorA: { value: new THREE.Color(RUBIKS_FACE_COLORS[portal.face]) },
      colorB: { value: new THREE.Color(RUBIKS_FACE_COLORS[portal.twin]) },
    },
  }), [portal.face, portal.twin]);
  useEffect(() => () => material.dispose(), [material]);
  useEffect(() => { group.current?.lookAt(0, 0, 0); }, [portal]);
  useFrame(() => {
    material.uniforms.time.value = clock.current * portal.spin * 4;
    if (group.current) group.current.children[1].rotation.z = clock.current * portal.spin;
  });
  return (
    <group ref={group} position={portal.position}>
      <mesh raycast={noRaycast}>
        <torusGeometry args={[portal.ring, portal.ring * 0.1, 12, 48]} />
        <meshBasicMaterial color={RUBIKS_FACE_COLORS[portal.face]} toneMapped={false} />
      </mesh>
      <mesh raycast={noRaycast} material={material}>
        <circleGeometry args={[portal.ring * 0.96, 48]} />
      </mesh>
    </group>
  );
}

export default function BackgroundAmbience({ size = 3 }) {
  const reducedFX = useGameStore(s => s.perfReducedFX);
  const layout = useMemo(() => ambienceLayout(size, reducedFX ? 'reduced' : 'full'), [size, reducedFX]);
  const still = useMemo(() => prefersReducedMotion(), []);
  const geometry = useMemo(() => cubeGeometry(), []);
  const texture = useMemo(() => stickerGridTexture(), []);
  const material = useMemo(() => new THREE.MeshBasicMaterial({ map: texture, vertexColors: true, toneMapped: false }), [texture]);
  useEffect(() => () => { geometry.dispose(); texture.dispose(); material.dispose(); }, [geometry, texture, material]);

  const mesh = useRef(null);
  const clock = useRef(0);
  const position = useMemo(() => [0, 0, 0], []);
  const matrix = useMemo(() => ({ m: new THREE.Matrix4(), q: new THREE.Quaternion(), e: new THREE.Euler(), p: new THREE.Vector3(), s: new THREE.Vector3() }), []);

  useFrame((_, delta) => {
    if (!still) clock.current += Math.min(delta, 0.1);
    const instanced = mesh.current;
    if (!instanced) return;
    const t = clock.current;
    layout.cubes.forEach((cube, i) => {
      cubePositionAt(cube, t, position);
      matrix.p.fromArray(position);
      matrix.e.set(cube.spin[0] * t + cube.phase, cube.spin[1] * t + cube.phase * 0.7, cube.spin[2] * t);
      matrix.q.setFromEuler(matrix.e);
      matrix.s.setScalar(cube.scale);
      instanced.setMatrixAt(i, matrix.m.compose(matrix.p, matrix.q, matrix.s));
    });
    instanced.instanceMatrix.needsUpdate = true;
  });

  return (
    <group>
      <instancedMesh key={layout.cubes.length} ref={mesh} args={[geometry, material, layout.cubes.length]}
        raycast={noRaycast} frustumCulled={false} />
      {layout.wormholes.map((portal, i) => <Portal key={`${size}-${i}`} portal={portal} clock={clock} />)}
    </group>
  );
}
