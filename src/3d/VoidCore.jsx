/**
 * VoidCore
 *
 * Animated wormhole-color rings at the cube's center void.
 * Renders 3 orbital lineLoop rings that cycle through all active tunnel
 * colors (stickers that have been flipped at least once).
 *
 * Visible on all cube sizes. For odd-sized cubes (3×3, 5×5) the center
 * cubie is skipped in CubeAssembly so VoidCore fills that space. For
 * even-sized cubes (2×2, 4×4) the origin is a natural gap between cubies.
 */
import React, { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useGameStore } from '../hooks/useGameStore.js';
import { resolveColors } from '../utils/colorSchemes.js';

// Shared geometries to avoid reallocation
const innerGeo = new THREE.SphereGeometry(0.28, 32, 32);
const outerGeo = new THREE.IcosahedronGeometry(0.38, 1);
const sparkGeo = new THREE.SphereGeometry(0.015, 6, 6);

const SPARK_COUNT = 40;

const coreVertexShader = `
  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vViewPosition;
  uniform float uTime;

  void main() {
    vUv = uv;
    vNormal = normalize(normalMatrix * normal);
    
    // Electric pulse displacement on the surface
    float pulse = sin(position.y * 15.0 + uTime * 10.0) * cos(position.x * 15.0 - uTime * 8.0) * 0.015;
    vec3 pos = position + normal * pulse;
    
    vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
    vViewPosition = -mvPosition.xyz;
    gl_Position = projectionMatrix * mvPosition;
  }
`;

const coreFragmentShader = `
  uniform vec3 uColor1;
  uniform vec3 uColor2;
  uniform float uTime;
  uniform float uOpacity;

  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vViewPosition;

  void main() {
    vec3 normal = normalize(vNormal);
    vec3 viewDir = normalize(vViewPosition);
    
    // Strong Fresnel rim lighting for an energetic glowing orb look
    float rim = 1.0 - max(dot(viewDir, normal), 0.0);
    rim = smoothstep(0.5, 1.0, rim);

    // High-frequency swirling plasma waves
    float plasma = sin(vUv.x * 30.0 + uTime * 5.0) * cos(vUv.y * 30.0 - uTime * 4.0);
    plasma = plasma * 0.5 + 0.5;

    // Mix two active colors from the palette for the raw energy
    vec3 baseColor = mix(uColor1, uColor2, plasma);
    
    // Core is glowing but doesn't blow out the HDR bloom
    vec3 finalColor = baseColor * (0.8 + rim * 0.5) + (mix(uColor1, uColor2, 0.5) * rim * 1.0);

    gl_FragColor = vec4(finalColor, uOpacity);
  }
`;

function VoidCore() {
  const cubies = useGameStore(s => s.cubies);
  const settings = useGameStore(s => s.settings);

  const innerCoreRef = useRef();
  const innerMatRef = useRef();
  const outerCageRef = useRef();
  const outerCageRef2 = useRef();
  const sparksRef = useRef();
  const tRef = useRef(0);

  const [uniforms] = React.useState(() => ({
    uColor1: { value: new THREE.Color() },
    uColor2: { value: new THREE.Color() },
    uTime: { value: 0 },
    uOpacity: { value: 0 }
  }));

  // Spark state: [theta, phi, speed, radiusOffset, phase]
  const sparks = useMemo(() => {
    const arr = [];
    for (let i = 0; i < SPARK_COUNT; i++) {
      arr.push({
        theta: Math.random() * Math.PI * 2,
        phi: Math.acos(2 * Math.random() - 1),
        speed: 2.0 + Math.random() * 4.0, // fast sparks
        rOffset: (Math.random() - 0.5) * 0.1,
        phase: Math.random() * Math.PI * 2,
      });
    }
    return arr;
  }, []);

  // Collect unique face colors from all flipped stickers
  const palette = useMemo(() => {
    const fc = resolveColors(settings, settings.biomeMode?.faceAssignment);
    const hexSet = new Set();
    for (const L of cubies)
      for (const R of L)
        for (const c of R)
          for (const k of Object.keys(c.stickers)) {
            const s = c.stickers[k];
            if ((s.flips || 0) > 0) {
              if (fc[s.orig]) hexSet.add(fc[s.orig]);
              if (fc[s.curr]) hexSet.add(fc[s.curr]);
            }
          }
    const cols = [...hexSet].map(h => new THREE.Color(h));
    return cols.length > 0 ? cols : [new THREE.Color('#444444'), new THREE.Color('#888888')]; // fallback
  }, [cubies, settings]);

  // Initialize colors
  useEffect(() => {
    if (!palette || palette.length < 1) return;
    uniforms.uColor1.value.copy(palette[0]);
    uniforms.uColor2.value.copy(palette[palette.length > 1 ? 1 : 0]);

    // Color wireframes
    if (outerCageRef.current) outerCageRef.current.material.color.copy(palette[0]);
    if (outerCageRef2.current) outerCageRef2.current.material.color.copy(palette[palette.length > 1 ? 1 : 0]);

    // Also color sparks
    const mesh = sparksRef.current;
    if (mesh) {
      for (let i = 0; i < SPARK_COUNT; i++) {
        mesh.setColorAt(i, palette[i % palette.length]);
      }
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    }
  }, [palette, uniforms]);

  const _dummy = useMemo(() => new THREE.Object3D(), []);

  useFrame((_, dt) => {
    tRef.current += dt;
    const t = tRef.current;

    // Check if the network is "active" (i.e. we have actual flipped colors)
    const active = palette && palette.length > 0 && !(palette.length === 2 && palette[0].getHexString() === '444444');

    // Fade in/out logic
    if (active) {
      uniforms.uOpacity.value = Math.min(1.0, uniforms.uOpacity.value + dt * 2.0);
    } else {
      uniforms.uOpacity.value = Math.max(0.0, uniforms.uOpacity.value - dt * 2.0);
    }

    uniforms.uTime.value = t;

    // Vibrate & rotate the inner core
    if (innerCoreRef.current) {
      innerCoreRef.current.rotation.y = t * 0.5;
      innerCoreRef.current.rotation.z = t * 0.3;
      const scale = 1.0 + Math.sin(t * 15.0) * 0.02;
      innerCoreRef.current.scale.setScalar(scale);
    }

    // Spin the outer wireframe cages rapidly on different axes like a gyroscope
    if (outerCageRef.current) {
      outerCageRef.current.rotation.x = t * 2.0;
      outerCageRef.current.rotation.y = t * 1.5;
      outerCageRef.current.material.opacity = uniforms.uOpacity.value * 0.15;
    }
    if (outerCageRef2.current) {
      outerCageRef2.current.rotation.x = -t * 1.2;
      outerCageRef2.current.rotation.z = t * 2.5;
      outerCageRef2.current.material.opacity = uniforms.uOpacity.value * 0.15;
    }

    // Animate the electric sparks
    const mesh = sparksRef.current;
    if (mesh && active) {
      mesh.material.opacity = uniforms.uOpacity.value * 0.9;
      for (let i = 0; i < SPARK_COUNT; i++) {
        const p = sparks[i];
        p.theta += p.speed * dt;
        p.phi += (Math.sin(t * 2.0 + p.phase)) * dt;

        // Sparks orbit tightly around the outer cage
        const r = 0.38 + p.rOffset + Math.abs(Math.sin(t * 8.0 + p.phase)) * 0.05;

        _dummy.position.setFromSphericalCoords(r, p.phi, p.theta);

        // Random scale flickering
        const scale = 0.5 + Math.random() * 1.5;
        _dummy.scale.setScalar(scale);

        _dummy.updateMatrix();
        mesh.setMatrixAt(i, _dummy.matrix);
      }
      mesh.instanceMatrix.needsUpdate = true;
    } else if (mesh) {
      mesh.material.opacity = 0;
    }
  });

  return (
    <group>
      <mesh ref={innerCoreRef} geometry={innerGeo}>
        <shaderMaterial
          ref={innerMatRef}
          vertexShader={coreVertexShader}
          fragmentShader={coreFragmentShader}
          uniforms={uniforms}
          transparent={true}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>

      <mesh ref={outerCageRef} geometry={outerGeo}>
        <meshBasicMaterial
          color="#ffffff"
          wireframe={true}
          transparent={true}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>

      <mesh ref={outerCageRef2} geometry={outerGeo} scale={1.05}>
        <meshBasicMaterial
          color="#ffffff"
          wireframe={true}
          transparent={true}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>

      <instancedMesh
        ref={sparksRef}
        args={[sparkGeo, null, SPARK_COUNT]}
      >
        <meshBasicMaterial
          color="#ffffff"
          transparent={true}
          opacity={0}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </instancedMesh>
    </group>
  );
}

export default VoidCore;
