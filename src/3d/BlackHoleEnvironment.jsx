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

          // Stars - scattered throughout space
          float stars = 0.0;
          for (int i = 0; i < 3; i++) {
            vec2 starCoord = coord * (8.0 + float(i) * 4.0);
            float starNoise = hash(floor(starCoord + float(i) * 100.0));
            if (starNoise > 0.98) {
              float starDist = length(fract(starCoord) - 0.5);
              stars += smoothstep(0.05, 0.0, starDist) * (0.3 + starNoise * 0.7);
            }
          }

          // Gravitational lensing - warp space near event horizon
          float lensing = smoothstep(0.5, 0.1, dist);
          float warpAngle = theta + lensing * sin(time * 0.2 + dist * 10.0) * 0.5;

          // Event horizon - absolute darkness at center
          float eventHorizon = smoothstep(0.25, 0.15, dist);

          // Accretion disk - rotating matter being pulled in
          float angle = warpAngle + time * 0.2;
          float diskPattern = sin(angle * 12.0 + dist * 25.0) * 0.5 + 0.5;
          float diskRadius = smoothstep(0.45, 0.2, dist) * smoothstep(0.15, 0.22, dist);
          float diskGlow = diskRadius * diskPattern;

          // Photon sphere - light bending around the singularity
          float photonSphere = smoothstep(0.18, 0.16, abs(dist - 0.17)) * 0.8;

          // Hawking radiation glow at event horizon edge
          float hawkingGlow = smoothstep(0.2, 0.16, abs(dist - 0.18)) * 0.6;

          // Turbulence in the accretion disk
          float turbulence = noise(coord * 15.0 + time * 0.15) * 0.2;

          // Gradient from event horizon to deep space
          float gradient = smoothstep(0.0, 0.8, dist);

          // Color scheme
          vec3 deepSpace = vec3(0.01, 0.01, 0.02); // Nearly black
          vec3 eventHorizonColor = vec3(0.0, 0.0, 0.0); // Pure black
          vec3 accretionOrange = vec3(0.9, 0.4, 0.1); // Hot orange
          vec3 accretionBlue = vec3(0.3, 0.5, 1.0); // Blue-shifted light
          vec3 photonYellow = vec3(1.0, 0.9, 0.5); // Yellow photon ring
          vec3 starColor = vec3(0.9, 0.95, 1.0); // Cool white stars

          // Build the final color
          vec3 color = mix(eventHorizonColor, deepSpace, gradient);

          // Add stars (dimmed near event horizon)
          color += starColor * stars * gradient * 0.8;

          // Add accretion disk glow
          color += accretionOrange * diskGlow * 0.7;
          color += accretionBlue * diskGlow * diskPattern * 0.3;

          // Add photon sphere
          color += photonYellow * photonSphere;

          // Add Hawking radiation
          color += accretionOrange * hawkingGlow * 0.5;

          // Add turbulence
          color += vec3(turbulence * 0.1);

          // Darken the event horizon
          color *= (1.0 - eventHorizon * 0.95);

          // Pulse effect on flip - brightens the entire black hole
          if (pulseIntensity > 0.0) {
            // Pulse is stronger near the event horizon
            float pulseFalloff = smoothstep(0.8, 0.0, dist);
            vec3 pulseColor = vec3(1.0, 0.6, 0.3); // Bright orange-white flash
            float pulseStrength = pulseIntensity * pulseFalloff * 0.8;
            color += pulseColor * pulseStrength;

            // Intensify accretion disk during pulse
            color += accretionOrange * diskGlow * pulseIntensity * 2.0;

            // Brighten photon sphere
            color += photonYellow * photonSphere * pulseIntensity * 1.5;
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
