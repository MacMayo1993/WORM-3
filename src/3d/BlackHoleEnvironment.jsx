import React, { useRef, useMemo, useState, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

export default function BlackHoleEnvironment({ flipTrigger = 0, zoom = 1.65, orbitStrength = 0.03, tint = null }) {
  const sphereRef = useRef();
  const materialRef = useRef();
  const [pulseIntensity, setPulseIntensity] = useState(0);

  useEffect(() => {
    if (flipTrigger > 0) setPulseIntensity(1.0);
  }, [flipTrigger]);

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
        mat3 ACESInputMat = mat3(
          0.59719, 0.07600, 0.02840,
          0.35458, 0.90834, 0.13383,
          0.04823, 0.01566, 0.83777
        );
        mat3 ACESOutputMat = mat3(
           1.60475, -0.10208, -0.00327,
          -0.53108,  1.10813, -0.07276,
          -0.07367, -0.00605,  1.07602
        );
        vec3 RRTAndODTFit(vec3 v) {
          vec3 a = v * (v + 0.0245786) - 0.000090537;
          vec3 b = v * (0.983729 * v + 0.4329510) + 0.238081;
          return a / b;
        }
        vec3 ACESFilmic(vec3 color) {
          color = ACESInputMat * color;
          color = RRTAndODTFit(color);
          color = ACESOutputMat * color;
          return clamp(color, 0.0, 1.0);
        }

        // ---- Rotation helper ----
        mat2 rot2(float a) {
          float s = sin(a), c = cos(a);
          return mat2(c, -s, s, c);
        }

        // ---- Noise functions ----
        float hash21(vec2 p) {
          return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
        }

        float hash11(float p) {
          return fract(sin(p * 127.1) * 43758.5453);
        }

        float noise(vec2 p) {
          vec2 i = floor(p);
          vec2 f = fract(p);
          f = f * f * (3.0 - 2.0 * f);
          float a = hash21(i);
          float b = hash21(i + vec2(1.0, 0.0));
          float c = hash21(i + vec2(0.0, 1.0));
          float d = hash21(i + vec2(1.0, 1.0));
          return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
        }

        float fbm(vec2 p, int octaves) {
          float value = 0.0;
          float amp = 0.5;
          float freq = 1.0;
          for (int i = 0; i < 6; i++) {
            if (i >= octaves) break;
            value += amp * noise(p * freq);
            freq *= 2.0;
            amp *= 0.5;
          }
          return value;
        }

        // Volumetric noise for 3D-like nebula density
        float nebulaDensity(vec2 p, float t) {
          float n = 0.0;
          n += fbm(p * 2.0 + vec2(t * 0.015, t * 0.01), 5) * 0.6;
          n += fbm(p * 4.0 - vec2(t * 0.02, -t * 0.008), 4) * 0.3;
          n += fbm(p * 8.0 + vec2(-t * 0.03, t * 0.025), 3) * 0.1;
          return clamp(n, 0.0, 1.0);
        }

        // ---- Film grain ----
        float grain(vec2 uv, float t) {
          return hash21(uv * 800.0 + fract(t * 7.13) * 100.0) * 0.04 - 0.02;
        }

        void main() {
          vec3 dir = normalize(vPosition);
          float theta = atan(dir.z, dir.x);
          float phi = acos(dir.y);

          vec2 center = vec2(0.5, 0.5) + centerOffset;
          vec2 coord = vec2(theta / (2.0 * 3.14159) + 0.5, phi / 3.14159);

          float dist = length(coord - center) * zoom;

          // ---- Schwarzschild-style gravitational lensing ----
          float rs = 0.18;  // Schwarzschild radius
          vec2 toCenter = coord - center;
          float r = length(toCenter);
          float deflection = rs / max(r * zoom, 0.001);
          deflection = min(deflection, 2.0);
          float angle = atan(toCenter.y, toCenter.x);
          float lensedR = r + deflection * 0.08 * sin(r * 30.0 - time * 0.3);
          vec2 lensedCoord = center + vec2(cos(angle), sin(angle)) * lensedR;

          // ---- DEEP SPACE BASE ----
          float gradient = smoothstep(0.0, 0.8, dist);
          vec3 deepSpace = vec3(0.005, 0.005, 0.015);

          // ---- ENHANCED STAR FIELD ----
          float stars = 0.0;

          // Bright stars (sparse, twinkling)
          for (int i = 0; i < 3; i++) {
            vec2 sc = lensedCoord * (12.0 + float(i) * 7.0);
            float sn = hash21(floor(sc + float(i) * 100.0));
            if (sn > 0.94) {
              float sd = length(fract(sc) - 0.5);
              float twinkle = 0.6 + 0.4 * sin(time * (1.5 + sn * 4.0) + sn * 80.0);
              stars += smoothstep(0.07, 0.0, sd) * (0.5 + sn * 0.5) * twinkle;
            }
          }

          // Medium stars
          for (int i = 0; i < 4; i++) {
            vec2 sc = lensedCoord * (22.0 + float(i) * 11.0);
            float sn = hash21(floor(sc + float(i) * 200.0));
            if (sn > 0.86) {
              float sd = length(fract(sc) - 0.5);
              float twinkle = 0.8 + 0.2 * sin(time * (1.0 + sn * 2.5) + sn * 60.0);
              stars += smoothstep(0.04, 0.0, sd) * (0.25 + sn * 0.3) * twinkle;
            }
          }

          // Faint dense field
          for (int i = 0; i < 5; i++) {
            vec2 sc = lensedCoord * (45.0 + float(i) * 16.0);
            float sn = hash21(floor(sc + float(i) * 300.0));
            if (sn > 0.79) {
              float sd = length(fract(sc) - 0.5);
              stars += smoothstep(0.025, 0.0, sd) * 0.12 * sn;
            }
          }

          // Star dust (milky way band)
          float dustBand = exp(-8.0 * pow(coord.y - 0.48 + sin(coord.x * 3.0) * 0.06, 2.0));
          float starDust = 0.0;
          for (int i = 0; i < 3; i++) {
            vec2 dc = lensedCoord * (90.0 + float(i) * 35.0);
            float dn = hash21(floor(dc + float(i) * 500.0));
            if (dn > 0.7) {
              float dd = length(fract(dc) - 0.5);
              starDust += smoothstep(0.02, 0.0, dd) * 0.06;
            }
          }
          starDust *= dustBand * 1.5;

          // Star colors: white / warm / blue based on hash
          float starColorSeed = hash21(lensedCoord * 50.0);
          vec3 starColor = vec3(0.92, 0.95, 1.0);
          if (starColorSeed > 0.7) starColor = vec3(1.0, 0.92, 0.75);
          if (starColorSeed > 0.9) starColor = vec3(0.72, 0.85, 1.0);

          // ---- VOLUMETRIC NEBULA ----
          float nDensity = nebulaDensity(lensedCoord * 1.5, time);
          float nebulaShape = smoothstep(0.35, 0.7, nDensity);
          nebulaShape *= smoothstep(0.15, 0.45, dist);  // fade near BH
          nebulaShape *= 0.5 + 0.5 * dustBand;          // concentrate near galactic plane

          // Nebula color palette: deep purples, blues, reds
          float colorSel = noise(lensedCoord * 2.5 + time * 0.01);
          float colorSel2 = noise(lensedCoord * 3.5 + 10.0);
          vec3 nebCol = vec3(0.0);
          nebCol += mix(vec3(0.20, 0.04, 0.30), vec3(0.04, 0.10, 0.28), colorSel);
          nebCol = mix(nebCol, vec3(0.28, 0.06, 0.04), smoothstep(0.5, 0.8, colorSel2));
          // Bright emission edges
          float nebulaEdge = smoothstep(0.55, 0.65, nDensity) - smoothstep(0.65, 0.8, nDensity);
          vec3 emissionColor = mix(vec3(0.5, 0.2, 0.8), vec3(0.2, 0.6, 0.9), colorSel);

          // ---- ACCRETION DISK ----
          float diskAngle = theta + time * 0.25;
          float diskWarp = diskAngle + deflection * sin(dist * 20.0) * 0.4;

          // Multi-ring structure
          float ring1 = smoothstep(0.45, 0.22, dist) * smoothstep(0.15, 0.20, dist);
          float ring2 = smoothstep(0.38, 0.25, dist) * smoothstep(0.19, 0.24, dist);
          float ringPattern = sin(diskWarp * 14.0 + dist * 30.0) * 0.5 + 0.5;
          float ringFine = sin(diskWarp * 40.0 + dist * 80.0) * 0.3 + 0.7;
          float turbulence = noise(coord * 18.0 + time * 0.2) * 0.2;
          float diskGlow = (ring1 * ringPattern + ring2 * ringFine * 0.5) * (1.0 + turbulence);

          // Doppler beaming: blueshift on approaching side, redshift on receding
          float dopplerPhase = sin(diskAngle) * 0.5 + 0.5;
          vec3 accretionHot = vec3(1.0, 0.85, 0.5);   // white-hot approaching
          vec3 accretionWarm = vec3(0.95, 0.4, 0.08);  // orange receding
          vec3 accretionCool = vec3(0.6, 0.15, 0.05);  // deep red far receding
          vec3 accretionBlue = vec3(0.35, 0.55, 1.0);  // blue-shifted
          vec3 diskColor = mix(accretionWarm, accretionHot, dopplerPhase);
          diskColor = mix(diskColor, accretionBlue, pow(dopplerPhase, 3.0) * 0.4);
          diskColor = mix(accretionCool, diskColor, smoothstep(0.0, 0.3, dopplerPhase));

          // ---- PHOTON SPHERE / INNERMOST RING ----
          float photonRing = smoothstep(0.015, 0.0, abs(dist - rs * zoom * 0.95)) * 1.2;
          vec3 photonColor = vec3(1.0, 0.95, 0.65);

          // Hawking glow at event horizon boundary
          float hawking = smoothstep(0.02, 0.0, abs(dist - rs * zoom)) * 0.7;
          vec3 hawkingColor = vec3(1.0, 0.5, 0.2);

          // ---- EVENT HORIZON ----
          float eventHorizon = smoothstep(rs * zoom + 0.02, rs * zoom - 0.01, dist);

          // ---- COMPOSE FINAL COLOR ----
          vec3 color = mix(vec3(0.0), deepSpace, gradient);

          // Nebula (behind disk)
          color += nebCol * nebulaShape * 0.20;
          color += emissionColor * nebulaEdge * 0.25;

          // Star dust
          color += vec3(0.55, 0.6, 0.8) * starDust * gradient;

          // Stars (dimmed near BH)
          color += starColor * stars * gradient * 0.85;

          // Accretion disk
          color += diskColor * diskGlow * 0.85;

          // Photon sphere
          color += photonColor * photonRing;

          // Hawking radiation
          color += hawkingColor * hawking;

          // Event horizon cutoff
          color *= (1.0 - eventHorizon * 0.97);

          // ---- PULSE ON FLIP ----
          if (pulseIntensity > 0.0) {
            float pulseFalloff = smoothstep(0.9, 0.0, dist);
            vec3 pulseCol = vec3(1.0, 0.65, 0.35);
            float pStr = pulseIntensity * pulseFalloff * 0.9;
            color += pulseCol * pStr;
            color += diskColor * diskGlow * pulseIntensity * 2.5;
            color += photonColor * photonRing * pulseIntensity * 2.0;
            color += starColor * stars * pulseIntensity * 0.4;
          }

          // ---- ACES TONE MAP ----
          color *= 1.4;  // exposure boost
          color = ACESFilmic(color);

          // ---- FILM GRAIN ----
          float g = grain(vUv, time);
          color += vec3(g);

          // Optional tint
          color *= uTint;

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

    if (pulseIntensity > 0) {
      setPulseIntensity((prev) => Math.max(0, prev - delta * 2.5));
    }
  });

  return (
    <mesh ref={sphereRef}>
      <sphereGeometry args={[100, 64, 64]} />
      <primitive object={shaderMaterial} ref={materialRef} attach="material" />
    </mesh>
  );
}
