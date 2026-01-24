import React, { useRef, useMemo, useState, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

/**
 * BlackHoleEnvironment - A dynamic 3D black hole background
 * Provides an immersive, panoramic black hole effect as part of the 3D scene
 */
export default function BlackHoleEnvironment({ flipTrigger = 0 }) {
  const sphereRef = useRef();
  const materialRef = useRef();
  const [pulseIntensity, setPulseIntensity] = useState(0);

  // Trigger pulse animation when flip occurs
  useEffect(() => {
    if (flipTrigger > 0) {
      setPulseIntensity(1.0); // Start at full intensity
    }
  }, [flipTrigger]);

  // Custom shader for smooth black hole effect
  const shaderMaterial = useMemo(() => {
    return new THREE.ShaderMaterial({
      side: THREE.BackSide,
      uniforms: {
        time: { value: 0 },
        pulseIntensity: { value: 0 },
      },
      vertexShader: `
        varying vec3 vPosition;
        varying vec2 vUv;

        void main() {
          vPosition = position;
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform float time;
        uniform float pulseIntensity;
        varying vec3 vPosition;
        varying vec2 vUv;

        // Smooth noise function
        float hash(vec2 p) {
          return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
        }

        float noise(vec2 p) {
          vec2 i = floor(p);
          vec2 f = fract(p);
          f = f * f * (3.0 - 2.0 * f);

          float a = hash(i);
          float b = hash(i + vec2(1.0, 0.0));
          float c = hash(i + vec2(0.0, 1.0));
          float d = hash(i + vec2(1.0, 1.0));

          return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
        }

        void main() {
          // Convert to spherical coordinates
          vec3 dir = normalize(vPosition);
          float theta = atan(dir.z, dir.x);
          float phi = acos(dir.y);

          // Center of black hole
          vec2 center = vec2(0.5, 0.5);
          vec2 coord = vec2(theta / (2.0 * 3.14159) + 0.5, phi / 3.14159);

          // Distance from center (event horizon)
          float dist = length(coord - center);

          // Rotating accretion disk
          float angle = theta + time * 0.15;
          float diskPattern = sin(angle * 8.0 + dist * 20.0) * 0.5 + 0.5;
          float diskGlow = smoothstep(0.6, 0.3, dist) * diskPattern;

          // Subtle turbulence
          float turbulence = noise(coord * 8.0 + time * 0.1) * 0.15;

          // Gradient from event horizon
          float gradient = smoothstep(0.0, 0.7, dist);

          // Deep space colors - very dark, subtle purples and blues
          vec3 deepSpace = vec3(0.02, 0.01, 0.03);
          vec3 eventHorizon = vec3(0.08, 0.04, 0.12);
          vec3 accretionGlow = vec3(0.25, 0.12, 0.15);

          // Mix colors
          vec3 color = mix(eventHorizon, deepSpace, gradient);
          color += accretionGlow * diskGlow * 0.3;
          color += vec3(turbulence * 0.05);

          // Very subtle vignette
          float vignette = smoothstep(0.0, 0.5, dist);
          color *= 0.7 + vignette * 0.3;

          // Pulse effect on flip - brightens the black hole
          if (pulseIntensity > 0.0) {
            // Pulse is stronger near the event horizon
            float pulseFalloff = smoothstep(0.7, 0.0, dist);
            vec3 pulseColor = vec3(0.8, 0.4, 0.6); // Purple-orange glow
            float pulseStrength = pulseIntensity * pulseFalloff * 0.6;
            color += pulseColor * pulseStrength;

            // Add a bright flash to the accretion disk
            color += accretionGlow * diskGlow * pulseIntensity * 1.5;
          }

          gl_FragColor = vec4(color, 1.0);
        }
      `,
    });
  }, []);

  useFrame((state, delta) => {
    if (materialRef.current) {
      materialRef.current.uniforms.time.value = state.clock.elapsedTime;
      materialRef.current.uniforms.pulseIntensity.value = pulseIntensity;
    }

    // Decay pulse intensity smoothly
    if (pulseIntensity > 0) {
      setPulseIntensity((prev) => Math.max(0, prev - delta * 2.5)); // Decay over ~0.4 seconds
    }
  });

  return (
    <mesh ref={sphereRef}>
      <sphereGeometry args={[100, 64, 64]} />
      <primitive object={shaderMaterial} ref={materialRef} attach="material" />
    </mesh>
  );
}
