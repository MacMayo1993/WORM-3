import React, { useRef, useMemo, useState, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

/**
 * BlackHoleEnvironment - A dynamic 3D black hole background
 * Provides an immersive, panoramic black hole effect as part of the 3D scene
 */
export default function BlackHoleEnvironment({ flipTrigger = 0, zoom = 1.65, orbitStrength = 0.03, tint = null }) {
  const sphereRef = useRef();
  const materialRef = useRef();
  const [pulseIntensity, setPulseIntensity] = useState(0);

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
        zoom: { value: zoom },
        centerOffset: { value: new THREE.Vector2(0, 0) },
        uTint: { value: new THREE.Color(1, 1, 1) },
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
        uniform float zoom;
        uniform vec2 centerOffset;
        uniform vec3 uTint;
        varying vec3 vPosition;
        varying vec2 vUv;

        // ---- ACES filmic tone mapping ----
        vec3 ACESFilmic(vec3 color) {
          const mat3 inputMat = mat3(
            0.59719, 0.07600, 0.02840,
            0.35458, 0.90834, 0.13383,
            0.04823, 0.01566, 0.83777
          );
          const mat3 outputMat = mat3(
             1.60475, -0.10208, -0.00327,
            -0.53108,  1.10813, -0.07276,
            -0.07367, -0.00605,  1.07602
          );
          color = inputMat * color;
          vec3 a = color * (color + 0.0245786) - 0.000090537;
          vec3 b = color * (0.983729 * color + 0.4329510) + 0.238081;
          color = a / b;
          color = outputMat * color;
          return clamp(color, 0.0, 1.0);
        }

        // Film grain
        float grain(vec2 uv, float t) {
          return fract(sin(dot(uv * 800.0 + fract(t * 7.13) * 100.0, vec2(127.1, 311.7))) * 43758.5453) * 0.03 - 0.015;
        }

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

        // 2D rotation for warping accretion disk
        mat2 calcRotation(float theta) {
          float c = cos(theta);
          float s = sin(theta);
          return mat2(c, -s, s, c);
        }

        void main() {
          // Convert to spherical coordinates
          vec3 dir = normalize(vPosition);
          float theta = atan(dir.z, dir.x);
          float phi = acos(dir.y);

          // Center of black hole
          vec2 center = vec2(0.5, 0.5) + centerOffset;
          vec2 coord = vec2(theta / (2.0 * 3.14159) + 0.5, phi / 3.14159);

          // Distance from center (event horizon).
          // zoom > 1 shrinks the event horizon so more of the black hole shape is visible.
          float dist = length(coord - center) * zoom;

          // === ENHANCED STARS ===
          float stars = 0.0;

          // Layer 1: Bright prominent stars (sparse)
          for (int i = 0; i < 3; i++) {
            vec2 starCoord = coord * (10.0 + float(i) * 6.0);
            float starNoise = hash(floor(starCoord + float(i) * 100.0));
            if (starNoise > 0.95) {
              float starDist = length(fract(starCoord) - 0.5);
              float twinkle = 0.7 + 0.3 * sin(time * (2.0 + starNoise * 3.0) + starNoise * 100.0);
              stars += smoothstep(0.06, 0.0, starDist) * (0.5 + starNoise * 0.5) * twinkle;
            }
          }

          // Layer 2: Medium stars (more frequent)
          for (int i = 0; i < 4; i++) {
            vec2 starCoord = coord * (20.0 + float(i) * 10.0);
            float starNoise = hash(floor(starCoord + float(i) * 200.0));
            if (starNoise > 0.88) {
              float starDist = length(fract(starCoord) - 0.5);
              float twinkle = 0.8 + 0.2 * sin(time * (1.5 + starNoise * 2.0) + starNoise * 50.0);
              stars += smoothstep(0.04, 0.0, starDist) * (0.3 + starNoise * 0.3) * twinkle;
            }
          }

          // Layer 3: Faint distant stars (dense field)
          for (int i = 0; i < 5; i++) {
            vec2 starCoord = coord * (40.0 + float(i) * 15.0);
            float starNoise = hash(floor(starCoord + float(i) * 300.0));
            if (starNoise > 0.81) {
              float starDist = length(fract(starCoord) - 0.5);
              stars += smoothstep(0.025, 0.0, starDist) * 0.15 * starNoise;
            }
          }

          // Layer 4: Very faint background star dust (milky way effect)
          float starDust = 0.0;
          for (int i = 0; i < 3; i++) {
            vec2 dustCoord = coord * (80.0 + float(i) * 30.0);
            float dustNoise = hash(floor(dustCoord + float(i) * 500.0));
            if (dustNoise > 0.72) {
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

          // === CINEMATIC EVENT HORIZON ===
          // Accretion disk with rotational warping
          float angle = warpAngle + time * 0.2;
          vec2 diskUV = (coord - center) * zoom;
          diskUV = calcRotation(time * 0.15) * diskUV;
          float diskAngle = atan(diskUV.y, diskUV.x);
          float diskPattern = sin(diskAngle * 12.0 + dist * 25.0 - time * 1.5) * 0.5 + 0.5;
          float diskDetail = sin(diskAngle * 24.0 + dist * 50.0 + time * 0.8) * 0.25 + 0.75;
          diskPattern *= diskDetail;
          float diskRadius = smoothstep(0.45, 0.2, dist) * smoothstep(0.15, 0.22, dist);
          float diskGlow = diskRadius * diskPattern;

          // Volumetric accretion structure via fbm
          float diskTurb = fbm(vec2(diskAngle * 3.0, dist * 10.0) + time * 0.1) * 0.5 + 0.5;
          diskGlow *= mix(0.6, 1.0, diskTurb);

          // Photon sphere with cinematic glow falloff. The chromatic offsets are
          // inspired by the referenced CodePen's post-process lensing shader, but kept
          // procedural so this environment stays a single R3F background mesh.
          float photonRing = abs(dist - 0.17);
          float photonSphere = smoothstep(0.02, 0.0, photonRing) * 1.2;
          float photonOuter = smoothstep(0.06, 0.02, photonRing) * 0.3;
          float lensFalloff = smoothstep(0.56, 0.12, dist);
          float lensArc = pow(max(0.0, 1.0 - abs(dist - 0.28) * 9.0), 2.0) * lensFalloff;
          vec2 radialDir = normalize((coord - center) * zoom + vec2(0.0001));
          float chromaR = fbm((coord + radialDir * 0.010) * 34.0 + vec2(time * 0.18, -time * 0.07));
          float chromaB = fbm((coord - radialDir * 0.012) * 36.0 + vec2(-time * 0.11, time * 0.15));
          vec3 chromaticLensing = vec3(chromaR * 1.2, 0.55 + diskTurb * 0.5, chromaB * 1.25) * lensArc;

          // Hawking radiation — subtle thermal glow with flicker
          float hawkingRing = abs(dist - 0.18);
          float hawkingFlicker = 0.8 + 0.2 * sin(time * 3.0 + dist * 40.0);
          float hawkingGlow = smoothstep(0.025, 0.0, hawkingRing) * 0.7 * hawkingFlicker;

          // Turbulence in the accretion disk
          float turbulence = noise(coord * 15.0 + time * 0.15) * 0.2;

          // Gradient from event horizon to deep space
          float gradient = smoothstep(0.0, 0.8, dist);

          // Color scheme — richer HDR palette for ACES mapping
          vec3 deepSpace = vec3(0.01, 0.01, 0.02);
          vec3 eventHorizonColor = vec3(0.0, 0.0, 0.0);
          vec3 accretionHot = vec3(1.35, 0.62, 0.12);
          vec3 accretionWarm = vec3(0.95, 0.32, 0.06);
          vec3 accretionRose = vec3(1.05, 0.22, 0.55);
          vec3 accretionBlue = vec3(0.25, 0.45, 1.35);
          vec3 photonYellow = vec3(1.5, 1.18, 0.56);
          vec3 starColor = vec3(0.9, 0.95, 1.0);
          vec3 warmStarColor = vec3(1.0, 0.9, 0.7);
          vec3 blueStarColor = vec3(0.7, 0.85, 1.0);

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

          // Add accretion disk — temperature gradient from hot inner to cool outer,
          // plus a CodePen-style multi-band violet/blue outer rim and hot white core.
          float tempGradient = smoothstep(0.4, 0.18, dist);
          vec3 diskColor = mix(accretionWarm, accretionHot, tempGradient);
          diskColor = mix(diskColor, accretionRose, diskPattern * smoothstep(0.18, 0.55, dist) * 0.28);
          diskColor = mix(diskColor, accretionBlue, diskPattern * (1.0 - tempGradient) * 0.46);
          diskColor = mix(diskColor, vec3(1.45, 1.18, 0.82), pow(tempGradient, 3.0) * 0.38);
          float dopplerBoost = 0.72 + 0.42 * smoothstep(-0.25, 0.85, sin(diskAngle + time * 0.25));
          color += diskColor * diskGlow * 0.9 * dopplerBoost;

          // Add photon sphere, Fresnel-like back glow, and procedural chromatic lensing
          color += photonYellow * photonSphere;
          color += photonYellow * photonOuter * 0.5;
          color += chromaticLensing * 0.28;

          // Add Hawking radiation
          color += accretionHot * hawkingGlow * 0.6;

          // Add turbulence
          color += vec3(turbulence * 0.1);

          // Darken the event horizon while preserving a thin fiery back-side rim.
          float horizonRim = smoothstep(0.19, 0.15, dist) * smoothstep(0.10, 0.15, dist);
          color += vec3(1.0, 0.38, 0.08) * horizonRim * (0.24 + 0.18 * sin(time * 2.5));
          color *= (1.0 - eventHorizon * 0.96);

          // Pulse effect on flip - brightens the entire black hole
          if (pulseIntensity > 0.0) {
            float pulseFalloff = smoothstep(0.8, 0.0, dist);
            vec3 pulseColor = vec3(1.0, 0.6, 0.3);
            float pulseStrength = pulseIntensity * pulseFalloff * 0.8;
            color += pulseColor * pulseStrength;

            color += accretionHot * diskGlow * pulseIntensity * 2.0;
            color += photonYellow * photonSphere * pulseIntensity * 1.5;
            color += finalStarColor * stars * pulseIntensity * 0.5;
          }

          // Optional colour cast (e.g. the cool blue used in the intro). Defaults to white.
          color *= uTint;

          // ---- ACES filmic tone mapping on the event horizon region ----
          // Apply cinematic grading selectively: full ACES near the black hole,
          // blending back to the raw color in deep space so stars stay crisp.
          float acesBlend = smoothstep(0.7, 0.1, dist);
          vec3 tonemapped = ACESFilmic(color * 1.4);
          color = mix(color, tonemapped, acesBlend);

          // Film grain — subtle analogue texture
          float g = grain(vUv, time);
          color += vec3(g);

          gl_FragColor = vec4(color, 1.0);
        }
      `,
    });
  }, [zoom]);

  useFrame((state, delta) => {
    if (materialRef.current) {
      materialRef.current.uniforms.time.value = state.clock.elapsedTime;
      materialRef.current.uniforms.pulseIntensity.value = pulseIntensity;
      materialRef.current.uniforms.zoom.value = zoom;
      if (tint) materialRef.current.uniforms.uTint.value.set(tint[0], tint[1], tint[2]);

      const t = state.clock.elapsedTime * 0.08;
      const orbitRadius = orbitStrength * (0.7 + 0.3 * Math.sin(state.clock.elapsedTime * 0.11));
      materialRef.current.uniforms.centerOffset.value.set(
        Math.cos(t) * orbitRadius,
        Math.sin(t * 1.17) * orbitRadius * 0.7
      );
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
