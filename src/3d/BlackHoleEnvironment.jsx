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

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (flipTrigger > 0) setPulseIntensity(1.0);
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

        // Fractal brownian motion for nebulae
        float fbm(vec2 p) {
          float value = 0.0;
          float amplitude = 0.5;
          for (int i = 0; i < 4; i++) {
            value += amplitude * noise(p);
            p *= 2.0;
            amplitude *= 0.5;
          }
          return value;
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

          // === ENHANCED STARS ===
          float stars = 0.0;

          // Layer 1: Bright prominent stars (sparse)
          for (int i = 0; i < 3; i++) {
            vec2 starCoord = coord * (10.0 + float(i) * 6.0);
            float starNoise = hash(floor(starCoord + float(i) * 100.0));
            if (starNoise > 0.97) {
              float starDist = length(fract(starCoord) - 0.5);
              float twinkle = 0.7 + 0.3 * sin(time * (2.0 + starNoise * 3.0) + starNoise * 100.0);
              stars += smoothstep(0.06, 0.0, starDist) * (0.5 + starNoise * 0.5) * twinkle;
            }
          }

          // Layer 2: Medium stars (more frequent)
          for (int i = 0; i < 4; i++) {
            vec2 starCoord = coord * (20.0 + float(i) * 10.0);
            float starNoise = hash(floor(starCoord + float(i) * 200.0));
            if (starNoise > 0.92) {
              float starDist = length(fract(starCoord) - 0.5);
              float twinkle = 0.8 + 0.2 * sin(time * (1.5 + starNoise * 2.0) + starNoise * 50.0);
              stars += smoothstep(0.04, 0.0, starDist) * (0.3 + starNoise * 0.3) * twinkle;
            }
          }

          // Layer 3: Faint distant stars (dense field)
          for (int i = 0; i < 5; i++) {
            vec2 starCoord = coord * (40.0 + float(i) * 15.0);
            float starNoise = hash(floor(starCoord + float(i) * 300.0));
            if (starNoise > 0.85) {
              float starDist = length(fract(starCoord) - 0.5);
              stars += smoothstep(0.025, 0.0, starDist) * 0.15 * starNoise;
            }
          }

          // Layer 4: Very faint background star dust (milky way effect)
          float starDust = 0.0;
          for (int i = 0; i < 3; i++) {
            vec2 dustCoord = coord * (80.0 + float(i) * 30.0);
            float dustNoise = hash(floor(dustCoord + float(i) * 500.0));
            if (dustNoise > 0.75) {
              float dustDist = length(fract(dustCoord) - 0.5);
              starDust += smoothstep(0.02, 0.0, dustDist) * 0.08;
            }
          }

          // === NEBULAE / GAS CLOUDS ===
          // Subtle colored nebula regions
          float nebula1 = fbm(coord * 3.0 + vec2(time * 0.02, 0.0));
          float nebula2 = fbm(coord * 4.0 + vec2(0.0, time * 0.015));
          float nebulaMask = smoothstep(0.4, 0.7, nebula1) * smoothstep(0.35, 0.65, nebula2);
          nebulaMask *= smoothstep(0.2, 0.5, dist); // Fade near black hole

          vec3 nebulaColor1 = vec3(0.15, 0.05, 0.2); // Deep purple
          vec3 nebulaColor2 = vec3(0.05, 0.1, 0.2);  // Deep blue
          vec3 nebulaColor3 = vec3(0.2, 0.08, 0.05); // Deep red/brown

          float nebulaSelect = noise(coord * 2.0);
          vec3 nebula = mix(nebulaColor1, nebulaColor2, nebulaSelect);
          nebula = mix(nebula, nebulaColor3, noise(coord * 3.0 + 10.0));

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
          vec3 warmStarColor = vec3(1.0, 0.9, 0.7); // Warm yellow stars
          vec3 blueStarColor = vec3(0.7, 0.85, 1.0); // Blue stars

          // Build the final color
          vec3 color = mix(eventHorizonColor, deepSpace, gradient);

          // Add nebula (very subtle, behind everything)
          color += nebula * nebulaMask * 0.15;

          // Add star dust (milky way glow)
          color += vec3(0.6, 0.65, 0.8) * starDust * gradient;

          // Add stars with color variation (dimmed near event horizon)
          float starColorMix = hash(coord * 50.0);
          vec3 finalStarColor = mix(starColor, warmStarColor, step(0.7, starColorMix));
          finalStarColor = mix(finalStarColor, blueStarColor, step(0.9, starColorMix));
          color += finalStarColor * stars * gradient * 0.9;

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

            // Make stars twinkle more during pulse
            color += finalStarColor * stars * pulseIntensity * 0.5;
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
