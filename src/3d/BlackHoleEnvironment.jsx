import React, { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { isMobile } from '../utils/device.js';

/**
 * BlackHoleEnvironment - A dynamic 3D black hole background
 * Provides an immersive, panoramic black hole effect as part of the 3D scene.
 *
 * Used by the intro animation, the main menu, and the blackhole level/theme.
 * The heavy lifting happens in the fragment shader, so the star field is built
 * from a handful of unrolled jittered-grid layers (instead of nested loops) and
 * the nebula reuses its fbm samples as color selectors. Mobile compiles a
 * LOW_FX variant with fewer octaves and no star dust/spikes/turbulence.
 */
export default function BlackHoleEnvironment({ flipTrigger = 0, zoom = 1.65, orbitStrength = 0.03, tint = null }) {
  const materialRef = useRef();
  // Pulse lives in a ref and is written straight to the uniform — decaying it
  // through setState would re-render the canvas tree every frame of the decay.
  const pulseRef = useRef(0);

  useEffect(() => {
    if (flipTrigger > 0) pulseRef.current = 1.0;
  }, [flipTrigger]);

  // Custom shader for smooth black hole effect
  const shaderMaterial = useMemo(() => {
    return new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      defines: isMobile ? { LOW_FX: '' } : {},
      uniforms: {
        time: { value: 0 },
        pulseIntensity: { value: 0 },
        zoom: { value: zoom },
        centerOffset: { value: new THREE.Vector2(0, 0) },
        uTint: { value: new THREE.Color(1, 1, 1) },
      },
      vertexShader: `
        varying vec3 vPosition;

        void main() {
          vPosition = position;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform float time;
        uniform float pulseIntensity;
        uniform float zoom;
        uniform vec2 centerOffset;
        uniform vec3 uTint;
        varying vec3 vPosition;

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
          #ifdef LOW_FX
          const int OCTAVES = 2;
          #else
          const int OCTAVES = 3;
          #endif
          for (int i = 0; i < OCTAVES; i++) {
            value += amplitude * noise(p);
            p *= 2.0;
            amplitude *= 0.5;
          }
          return value;
        }

        // One jittered-grid star layer. Stars spawn in grid cells whose hash
        // clears the threshold, offset randomly inside the cell so no grid
        // pattern shows. twinkleAmp > 0 makes the layer shimmer over time.
        float starLayer(vec2 p, float threshold, float size, float twinkleAmp) {
          vec2 cell = floor(p);
          float h = hash(cell);
          if (h < threshold) return 0.0;
          vec2 jitter = vec2(hash(cell + 17.3), hash(cell + 41.7)) - 0.5;
          vec2 f = fract(p) - 0.5 - jitter * 0.55;
          float brightness = (h - threshold) / (1.0 - threshold);
          float twinkle = 1.0 - twinkleAmp + twinkleAmp * (0.5 + 0.5 * sin(time * (1.5 + h * 3.0) + h * 100.0));
          float star = smoothstep(size, 0.0, length(f)) * (0.35 + 0.65 * brightness) * twinkle;
          #ifndef LOW_FX
          // Diffraction cross on the very brightest stars
          if (h > 0.965) {
            float spike = smoothstep(0.42, 0.0, abs(f.x)) * smoothstep(0.035, 0.0, abs(f.y))
                        + smoothstep(0.42, 0.0, abs(f.y)) * smoothstep(0.035, 0.0, abs(f.x));
            star += spike * 0.4 * twinkle;
          }
          #endif
          return star;
        }

        void main() {
          // Convert to spherical coordinates
          vec3 dir = normalize(vPosition);
          float theta = atan(dir.z, dir.x);
          float phi = acos(clamp(dir.y, -1.0, 1.0));

          // Center of black hole
          vec2 center = vec2(0.5, 0.5) + centerOffset;
          vec2 coord = vec2(theta / (2.0 * 3.14159) + 0.5, phi / 3.14159);

          // Distance from center (event horizon).
          // zoom > 1 shrinks the event horizon so more of the black hole shape is visible.
          float dist = length(coord - center) * zoom;

          // The star/nebula field drifts very slowly behind the (fixed) black
          // hole for a subtle parallax feel.
          vec2 sky = coord + vec2(time * 0.0015, 0.0);

          // === STARS === (unrolled jittered-grid layers)
          float stars = 0.0;
          stars += starLayer(sky * 12.0, 0.80, 0.10, 0.30) * 0.95; // bright, sparse, twinkling
          stars += starLayer(sky * 27.0, 0.84, 0.13, 0.15) * 0.55; // medium
          stars += starLayer(sky * 55.0, 0.80, 0.16, 0.0) * 0.28;  // faint dense field

          // Very faint background star dust (milky way effect)
          #ifndef LOW_FX
          float starDust = starLayer(sky * 95.0, 0.72, 0.22, 0.0) * 0.10;
          #else
          float starDust = 0.0;
          #endif

          // === NEBULAE / GAS CLOUDS ===
          // Two fbm fields shape the clouds and double as color selectors.
          float nebula1 = fbm(sky * 3.0 + vec2(time * 0.02, 0.0));
          float nebula2 = fbm(sky * 4.0 + vec2(0.0, time * 0.015));
          float nebulaMask = smoothstep(0.38, 0.72, nebula1) * smoothstep(0.33, 0.68, nebula2);
          nebulaMask *= smoothstep(0.2, 0.5, dist); // Fade near black hole

          vec3 nebula = mix(vec3(0.17, 0.06, 0.28), vec3(0.05, 0.11, 0.26), smoothstep(0.3, 0.7, nebula2)); // violet -> indigo
          nebula = mix(nebula, vec3(0.03, 0.15, 0.17), smoothstep(0.45, 0.8, nebula1));                     // teal pockets
          nebula += vec3(0.22, 0.06, 0.20) * smoothstep(0.32, 0.6, nebula1 * nebula2);                      // magenta cores

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

          // Gradient from event horizon to deep space
          float gradient = smoothstep(0.0, 0.8, dist);

          // Color scheme
          vec3 deepSpace = vec3(0.012, 0.012, 0.025); // Nearly black with a blue lean
          vec3 eventHorizonColor = vec3(0.0, 0.0, 0.0); // Pure black
          vec3 accretionOrange = vec3(0.9, 0.4, 0.1); // Hot orange
          vec3 accretionBlue = vec3(0.3, 0.5, 1.0); // Blue-shifted light
          vec3 photonYellow = vec3(1.0, 0.9, 0.5); // Yellow photon ring
          vec3 starColor = vec3(0.9, 0.95, 1.0); // Cool white stars
          vec3 warmStarColor = vec3(1.0, 0.9, 0.7); // Warm yellow stars
          vec3 blueStarColor = vec3(0.7, 0.85, 1.0); // Blue stars

          // Build the final color
          vec3 color = mix(eventHorizonColor, deepSpace, gradient);

          // Add nebula (subtle, behind everything)
          color += nebula * nebulaMask * 0.24;

          // Add star dust (milky way glow)
          color += vec3(0.6, 0.65, 0.8) * starDust * gradient;

          // Add stars with color variation (dimmed near event horizon)
          float starColorMix = hash(floor(sky * 50.0));
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

          // Turbulence shimmer in the accretion disk region
          #ifndef LOW_FX
          float turbulence = noise(sky * 15.0 + time * 0.15) * 0.2;
          color += vec3(turbulence * 0.1);
          #endif

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

          // Optional colour cast (e.g. the cool blue used in the intro). Defaults to white.
          color *= uTint;

          gl_FragColor = vec4(color, 1.0);
        }
      `,
    });
    // Material is created once; zoom/tint are fed through uniforms each frame.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useFrame((state, delta) => {
    const mat = materialRef.current;
    if (!mat) return;

    mat.uniforms.time.value = state.clock.elapsedTime;
    mat.uniforms.zoom.value = zoom;
    if (tint) mat.uniforms.uTint.value.setRGB(tint[0], tint[1], tint[2]);

    const t = state.clock.elapsedTime * 0.08;
    const orbitRadius = orbitStrength * (0.7 + 0.3 * Math.sin(state.clock.elapsedTime * 0.11));
    mat.uniforms.centerOffset.value.set(
      Math.cos(t) * orbitRadius,
      Math.sin(t * 1.17) * orbitRadius * 0.7
    );

    // Decay pulse intensity smoothly (~0.4s), without touching React state
    if (pulseRef.current > 0) {
      pulseRef.current = Math.max(0, pulseRef.current - delta * 2.5);
    }
    mat.uniforms.pulseIntensity.value = pulseRef.current;
  });

  return (
    <mesh frustumCulled={false}>
      <sphereGeometry args={[100, 48, 32]} />
      <primitive object={shaderMaterial} ref={materialRef} attach="material" />
    </mesh>
  );
}
