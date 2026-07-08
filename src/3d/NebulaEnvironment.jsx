import React, { useRef, useMemo, useState, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

export default function NebulaEnvironment({ flipTrigger = 0 }) {
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

        // ---- 3D Simplex noise ----
        vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
        vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
        vec4 permute(vec4 x) { return mod289(((x * 34.0) + 1.0) * x); }
        vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }

        float snoise(vec3 v) {
          const vec2 C = vec2(1.0/6.0, 1.0/3.0);
          const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
          vec3 i = floor(v + dot(v, C.yyy));
          vec3 x0 = v - i + dot(i, C.xxx);
          vec3 g = step(x0.yzx, x0.xyz);
          vec3 l = 1.0 - g;
          vec3 i1 = min(g.xyz, l.zxy);
          vec3 i2 = max(g.xyz, l.zxy);
          vec3 x1 = x0 - i1 + C.xxx;
          vec3 x2 = x0 - i2 + C.yyy;
          vec3 x3 = x0 - D.yyy;
          i = mod289(i);
          vec4 p = permute(permute(permute(
            i.z + vec4(0.0, i1.z, i2.z, 1.0))
            + i.y + vec4(0.0, i1.y, i2.y, 1.0))
            + i.x + vec4(0.0, i1.x, i2.x, 1.0));
          float n_ = 0.142857142857;
          vec3 ns = n_ * D.wyz - D.xzx;
          vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
          vec4 x_ = floor(j * ns.z);
          vec4 y_ = floor(j - 7.0 * x_);
          vec4 x = x_ * ns.x + ns.yyyy;
          vec4 y = y_ * ns.x + ns.yyyy;
          vec4 h = 1.0 - abs(x) - abs(y);
          vec4 b0 = vec4(x.xy, y.xy);
          vec4 b1 = vec4(x.zw, y.zw);
          vec4 s0 = floor(b0) * 2.0 + 1.0;
          vec4 s1 = floor(b1) * 2.0 + 1.0;
          vec4 sh = -step(h, vec4(0.0));
          vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
          vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;
          vec3 p0 = vec3(a0.xy, h.x);
          vec3 p1 = vec3(a0.zw, h.y);
          vec3 p2 = vec3(a1.xy, h.z);
          vec3 p3 = vec3(a1.zw, h.w);
          vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2,p2), dot(p3,p3)));
          p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
          vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
          m = m * m;
          return 42.0 * dot(m*m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
        }

        float fbm(vec3 p) {
          float f = 0.0;
          f += 0.5000 * snoise(p); p *= 2.01;
          f += 0.2500 * snoise(p); p *= 2.02;
          f += 0.1250 * snoise(p); p *= 2.03;
          f += 0.0625 * snoise(p); p *= 2.04;
          f += 0.0312 * snoise(p);
          return f;
        }

        float hash3(vec3 p) {
          return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453);
        }

        float hash21(vec2 p) {
          return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
        }

        // Film grain
        float grain(vec2 uv, float t) {
          return hash21(uv * 800.0 + fract(t * 7.13) * 100.0) * 0.035 - 0.0175;
        }

        void main() {
          vec3 dir = normalize(vPosition);
          float t = time * 0.04;

          // ---- Volumetric nebula layers ----
          // Multiple noise samples at different scales and speeds create depth
          vec3 np1 = dir * 2.0 + vec3(t, t * 0.7, t * 0.3);
          vec3 np2 = dir * 3.8 + vec3(-t * 0.5, t * 0.4, -t * 0.6);
          vec3 np3 = dir * 1.3 + vec3(t * 0.3, -t * 0.2, t * 0.8);
          vec3 np4 = dir * 5.0 + vec3(t * 0.15, t * 0.35, -t * 0.1);

          float n1 = fbm(np1) * 0.5 + 0.5;
          float n2 = fbm(np2) * 0.5 + 0.5;
          float n3 = fbm(np3) * 0.5 + 0.5;
          float n4 = fbm(np4) * 0.5 + 0.5;

          // Nebula color palette: emission nebula inspired
          vec3 magenta   = vec3(0.65, 0.05, 0.35);
          vec3 crimson   = vec3(0.7, 0.08, 0.12);
          vec3 teal      = vec3(0.02, 0.35, 0.45);
          vec3 deepBlue  = vec3(0.04, 0.08, 0.35);
          vec3 purple    = vec3(0.25, 0.05, 0.45);
          vec3 amber     = vec3(0.55, 0.20, 0.02);
          vec3 cyan      = vec3(0.05, 0.5, 0.55);

          // Build up nebula structure
          vec3 nebula = vec3(0.0);

          // Primary emission clouds
          float cloud1 = smoothstep(0.3, 0.7, n1);
          float cloud2 = smoothstep(0.35, 0.75, n2);
          float cloud3 = smoothstep(0.25, 0.65, n3);

          nebula += mix(magenta, crimson, n2) * cloud1 * 0.45;
          nebula += teal * cloud2 * 0.35;
          nebula += mix(purple, deepBlue, n1) * pow(n3, 2.0) * 0.55;
          nebula += amber * pow(n1 * n2, 2.0) * 0.30;

          // Bright emission filaments at cloud edges
          float edge1 = smoothstep(0.45, 0.55, n1) - smoothstep(0.55, 0.7, n1);
          float edge2 = smoothstep(0.50, 0.60, n2) - smoothstep(0.60, 0.75, n2);
          nebula += cyan * edge1 * 0.4;
          nebula += vec3(0.7, 0.4, 0.9) * edge2 * 0.3;

          // Fine detail layer
          float detail = smoothstep(0.4, 0.8, n4);
          nebula += vec3(0.3, 0.15, 0.5) * detail * 0.15;

          // Bright core regions where multiple clouds intersect
          float core = pow(max(0.0, n1 * n2 * n3), 2.5);
          vec3 coreGlow = mix(vec3(0.9, 0.7, 1.0), vec3(1.0, 0.85, 0.6), n3);

          // Dark absorption lanes
          float absorption = smoothstep(0.55, 0.45, n3) * smoothstep(0.6, 0.5, n1);

          // ---- Background ----
          vec3 color = vec3(0.004, 0.002, 0.012);
          color += nebula * (1.0 - absorption * 0.5);
          color += coreGlow * core * 0.3;

          // ---- Star field ----
          // Volumetric 3D star placement for natural distribution
          vec3 sp = dir * 90.0;
          vec3 cell = floor(sp);
          float stars = 0.0;
          for (int dx = -1; dx <= 1; dx++) {
            for (int dy = -1; dy <= 1; dy++) {
              for (int dz = -1; dz <= 1; dz++) {
                vec3 neighbor = cell + vec3(float(dx), float(dy), float(dz));
                vec3 starPos = neighbor + vec3(
                  hash3(neighbor),
                  hash3(neighbor + 100.0),
                  hash3(neighbor + 200.0)
                );
                float d = length(sp - starPos);
                float brightness = hash3(neighbor + 300.0);
                float twinkle = 0.6 + 0.4 * sin(time * (1.5 + brightness * 4.0) + brightness * 6.28);
                float star = smoothstep(0.03, 0.0, d) * twinkle * (0.3 + brightness * 0.7);
                stars += star;
              }
            }
          }

          // Star color variation
          float starSeed = hash3(floor(dir * 90.0) + 50.0);
          vec3 starColor = vec3(0.92, 0.95, 1.0);
          if (starSeed > 0.65) starColor = vec3(1.0, 0.9, 0.72);
          if (starSeed > 0.85) starColor = vec3(0.7, 0.82, 1.0);
          if (starSeed > 0.95) starColor = vec3(1.0, 0.7, 0.6);

          // Stars dimmed behind dense nebula
          float nebulaOcclusion = 1.0 - smoothstep(0.0, 0.3, length(nebula)) * 0.6;
          color += starColor * stars * nebulaOcclusion;

          // ---- Pulse on flip ----
          if (pulseIntensity > 0.01) {
            color += nebula * pulseIntensity * 1.8;
            color += coreGlow * core * pulseIntensity * 2.0;
            color += vec3(0.12, 0.06, 0.18) * pulseIntensity * 0.5;
          }

          // ---- ACES tone mapping ----
          color *= 1.3;
          color = ACESFilmic(color);

          // ---- Film grain ----
          float g = grain(vUv, time);
          color += vec3(g);

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
    if (pulseIntensity > 0) {
      setPulseIntensity((prev) => Math.max(0, prev - delta * 2.5));
    }
  });

  return (
    <mesh>
      <sphereGeometry args={[100, 48, 48]} />
      <primitive object={shaderMaterial} ref={materialRef} attach="material" />
    </mesh>
  );
}
