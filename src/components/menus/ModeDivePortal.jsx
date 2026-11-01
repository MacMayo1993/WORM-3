import React, { useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { getModeDiveState, isCarouselActive } from './menuCarouselState.js';
import { DIVE_PORTAL_LIFT, DIVE_ZOOM_START, FACE_NORMALS, portalOpenAt } from './menuDiveLeap.js';

// The portal PLAY opens in the middle of the presented face: a swirling well
// in the mode's colour that the player's worm leaps into, and that the camera
// then falls through. One quad and one program, mounted with the carousel and
// hidden until a dive.
const RADIUS = 0.56;

const VERTEX = /* glsl */`
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;
// The quad spans twice the portal, so its shockwave can ring out past the rim.
const FRAGMENT = /* glsl */`
  uniform vec3 uColor;
  uniform float uOpen;
  uniform float uTime;
  uniform float uWave;
  uniform float uFlood;
  varying vec2 vUv;
  void main() {
    vec2 p = (vUv - 0.5) * 4.0;          // portal radius = 1
    float r = length(p);
    float open = max(uOpen, 1e-3);
    float rr = r / open;
    float a = atan(p.y, p.x);
    // The well: spiral arms turning in, darkening to the centre.
    float arms = sin(a * 3.0 + log(max(rr, 1e-3)) * 7.0 - uTime * 9.0);
    float depth = smoothstep(0.0, 1.0, rr);
    vec3 deep = mix(vec3(0.02, 0.03, 0.05), uColor * 0.5, depth);
    vec3 well = mix(deep, uColor * 1.15, smoothstep(0.55, 1.0, arms * 0.5 + 0.5) * depth * 0.6);
    // A bright rim, and the centre filling with light as the camera falls in.
    float rim = smoothstep(0.86, 0.97, rr) * (1.0 - smoothstep(0.97, 1.04, rr));
    vec3 color = mix(well, vec3(1.0), rim * 0.7) + uColor * rim * 0.6;
    color = mix(color, mix(uColor, vec3(1.0), 0.35), uFlood * (1.0 - smoothstep(0.0, 1.0, rr)) );
    float inside = 1.0 - smoothstep(1.0, 1.04, rr);
    // The shockwave as the worm goes in.
    float wave = uWave > 0.0 ? (1.0 - smoothstep(0.0, 0.09, abs(r - (1.0 + uWave * 1.0)))) * (1.0 - uWave) : 0.0;
    float alpha = max(inside, wave * 0.8);
    if (alpha < 0.01) discard;
    gl_FragColor = vec4(mix(color, uColor + 0.35, wave * (1.0 - inside)), alpha);
    #include <colorspace_fragment>
  }
`;

const clamp01 = v => Math.max(0, Math.min(1, v));

export default function ModeDivePortal({ colors }) {
  const portal = useMemo(() => {
    const material = new THREE.ShaderMaterial({
      uniforms: {
        uColor: { value: new THREE.Color('#ffffff') }, uOpen: { value: 0 }, uTime: { value: 0 },
        uWave: { value: 0 }, uFlood: { value: 0 },
      },
      vertexShader: VERTEX, fragmentShader: FRAGMENT,
      transparent: true, depthWrite: false,
      polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4,
    });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(RADIUS * 4, RADIUS * 4), material);
    mesh.name = 'mode-dive-portal';
    mesh.visible = false;
    // After the worm (40), so a bead below the face is covered by the well.
    mesh.renderOrder = 41;
    return mesh;
  }, []);
  useEffect(() => () => { portal.geometry.dispose(); portal.material.dispose(); }, [portal]);
  const zAxis = useMemo(() => new THREE.Vector3(0, 0, 1), []);
  const normal = useMemo(() => new THREE.Vector3(), []);
  useFrame((_state, delta) => {
    const dive = isCarouselActive() ? getModeDiveState() : null;
    portal.visible = !!dive && !dive.reduced;
    if (!portal.visible) return;
    const n = FACE_NORMALS[dive.face] ?? FACE_NORMALS.PZ;
    normal.set(n[0], n[1], n[2]);
    portal.position.copy(normal).multiplyScalar(DIVE_PORTAL_LIFT);
    portal.quaternion.setFromUnitVectors(zAxis, normal);
    const u = portal.material.uniforms;
    u.uColor.value.set(colors?.[dive.face] ?? '#ffffff');
    u.uOpen.value = portalOpenAt(dive.t);
    u.uTime.value += Math.min(delta, 0.05);
    u.uWave.value = dive.t > DIVE_ZOOM_START ? clamp01((dive.t - DIVE_ZOOM_START) / 0.35) : 0;
    u.uFlood.value = clamp01((dive.t - DIVE_ZOOM_START - 0.1) / 0.4);
  });
  return <primitive object={portal} dispose={null} />;
}
